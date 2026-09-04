-- Configurable, date-bound direct-income promotions for AutoPool and Launch plans.
-- AutoPool starts with the requested 4 USDT / 15-day offer. Admins may change,
-- disable, or reschedule either plan independently from the back office.

INSERT INTO public.tbl_system_settings (tss_setting_key, tss_setting_value, tss_description)
VALUES (
  'direct_income_offer_config',
  jsonb_build_object(
    'autopool', jsonb_build_object(
      'enabled', true,
      'amount', 4,
      'startAt', to_jsonb(now()),
      'endAt', to_jsonb(now() + interval '15 days')
    ),
    'launch', jsonb_build_object(
      'enabled', false,
      'amount', 4,
      'startAt', to_jsonb(now()),
      'endAt', to_jsonb(now() + interval '15 days')
    )
  ),
  'Date-bound promotional direct-income overrides for AutoPool and Launch plans'
)
ON CONFLICT (tss_setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_active_direct_income_offer(p_plan text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_offer jsonb;
  v_amount numeric;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF lower(COALESCE(p_plan, '')) NOT IN ('autopool', 'launch') THEN
    RETURN NULL;
  END IF;

  SELECT tss_setting_value INTO v_config
  FROM public.tbl_system_settings
  WHERE tss_setting_key = 'direct_income_offer_config';

  v_offer := v_config -> lower(p_plan);
  IF v_offer IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    IF COALESCE((v_offer ->> 'enabled')::boolean, false) = false THEN
      RETURN NULL;
    END IF;
    v_amount := (v_offer ->> 'amount')::numeric;
    v_start := (v_offer ->> 'startAt')::timestamptz;
    v_end := (v_offer ->> 'endAt')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_amount <= 0 OR v_start IS NULL OR v_end IS NULL OR v_start > v_end
     OR now() < v_start OR now() > v_end THEN
    RETURN NULL;
  END IF;

  RETURN v_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_direct_income_offer(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_direct_income_offer(text) TO service_role;

CREATE OR REPLACE FUNCTION public.award_autopool_20_direct_income(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_parent_id uuid;
  v_amount numeric(18,6);
  v_offer_amount numeric(18,6);
  v_wallet_id uuid;
  v_income_id uuid;
  v_wallet_tx_id uuid;
  v_parent_account text;
BEGIN
  SELECT p.tp_id, p.tp_user_id, p.tp_subscription_id, p.tp_payment_status, sp.tsp_product_code
  INTO v_payment
  FROM public.tbl_payments p
  JOIN public.tbl_user_subscriptions us ON us.tus_id = p.tp_subscription_id
  JOIN public.tbl_subscription_plans sp ON sp.tsp_id = us.tus_plan_id
  WHERE p.tp_id = p_payment_id;

  IF NOT FOUND OR v_payment.tp_payment_status <> 'completed' OR v_payment.tsp_product_code <> 'autopool_20' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_completed_autopool_payment');
  END IF;

  IF EXISTS (SELECT 1 FROM public.tbl_autopool_20_direct_income WHERE ta20di_payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  SELECT NULLIF(trim(profile.tup_parent_account), ''), user_record.tu_referrer_id
  INTO v_parent_account, v_parent_id
  FROM public.tbl_users user_record
  LEFT JOIN public.tbl_user_profiles profile ON profile.tup_user_id = user_record.tu_id
  WHERE user_record.tu_id = v_payment.tp_user_id;

  IF v_parent_id IS NULL AND v_parent_account IS NOT NULL THEN
    SELECT profile.tup_user_id INTO v_parent_id
    FROM public.tbl_user_profiles profile
    WHERE public.normalize_sponsorship_key(profile.tup_sponsorship_number) = public.normalize_sponsorship_key(v_parent_account)
    LIMIT 1;
  END IF;

  IF v_parent_id IS NULL OR v_parent_id = v_payment.tp_user_id
     OR NOT EXISTS (
       SELECT 1 FROM public.tbl_users
       WHERE tu_id = v_parent_id AND COALESCE(tu_is_active, false) AND COALESCE(tu_registration_paid, false)
     ) THEN
    INSERT INTO public.tbl_autopool_20_direct_income (
      ta20di_payment_id, ta20di_subscription_id, ta20di_joined_user_id,
      ta20di_parent_user_id, ta20di_amount, ta20di_status
    ) VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, NULL, 0, 'skipped')
    ON CONFLICT (ta20di_payment_id) DO NOTHING;
    RETURN jsonb_build_object('success', true, 'credited', false, 'reason', 'eligible_parent_not_found');
  END IF;

  v_offer_amount := public.get_active_direct_income_offer('autopool');
  IF v_offer_amount IS NOT NULL THEN
    v_amount := LEAST(20, GREATEST(0, v_offer_amount));
  ELSE
    SELECT LEAST(20, GREATEST(0, COALESCE(NULLIF(tss_setting_value #>> '{}', '')::numeric, 2)))
    INTO v_amount FROM public.tbl_system_settings WHERE tss_setting_key = 'autopool_20_direct_income';
    v_amount := COALESCE(v_amount, 2);
  END IF;

  INSERT INTO public.tbl_autopool_20_direct_income (
    ta20di_payment_id, ta20di_subscription_id, ta20di_joined_user_id, ta20di_parent_user_id, ta20di_amount
  ) VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, v_parent_id, v_amount)
  ON CONFLICT (ta20di_payment_id) DO NOTHING
  RETURNING ta20di_id INTO v_income_id;

  IF v_income_id IS NULL THEN RETURN jsonb_build_object('success', true, 'deduped', true); END IF;

  v_wallet_id := public.ensure_working_wallet(v_parent_id);
  INSERT INTO public.tbl_wallet_transactions (
    twt_wallet_id, twt_user_id, twt_transaction_type, twt_amount,
    twt_description, twt_status, twt_reference_type, twt_reference_id, twt_created_at
  ) VALUES (
    v_wallet_id, v_parent_id, 'credit', v_amount,
    CASE WHEN v_offer_amount IS NULL THEN 'Direct income from 20 USDT AutoPool purchase'
         ELSE 'Promotional direct income from 20 USDT AutoPool purchase' END,
    'completed', 'autopool_20_direct_income', v_income_id, now()
  ) RETURNING twt_id INTO v_wallet_tx_id;

  UPDATE public.tbl_wallets SET tw_balance = COALESCE(tw_balance, 0) + v_amount, tw_updated_at = now() WHERE tw_id = v_wallet_id;
  UPDATE public.tbl_autopool_20_direct_income SET ta20di_wallet_transaction_id = v_wallet_tx_id WHERE ta20di_id = v_income_id;

  RETURN jsonb_build_object('success', true, 'credited', true, 'amount', v_amount, 'offer_applied', v_offer_amount IS NOT NULL, 'parent_user_id', v_parent_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_autopool_20_direct_income(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_autopool_20_direct_income(uuid) TO service_role;

-- Launch offer applies only to level 1 (the direct sponsor). Levels 2 and 3
-- retain their configured percentages and all eligibility/package-cap rules.
CREATE OR REPLACE FUNCTION public.award_launch_joining_commissions_for_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_level integer;
  v_recipient_id uuid;
  v_percent numeric(9,6);
  v_required_directs integer;
  v_direct_count integer;
  v_recipient_subscription_id uuid;
  v_requested_amount numeric(18,6);
  v_amount numeric(18,6);
  v_plan_amount numeric(18,6);
  v_offer_amount numeric(18,6);
  v_commission_id uuid;
  v_wallet_id uuid;
  v_wallet_tx_id uuid;
  v_joined_label text;
  v_credited_total numeric(18,6) := 0;
  v_credit_count integer := 0;
  v_locked_count integer := 0;
  v_skipped_count integer := 0;
BEGIN
  SELECT p.tp_user_id, p.tp_subscription_id, p.tp_payment_status, p.tp_amount,
         us.tus_payment_amount, sp.tsp_price,
         COALESCE(us.tus_plan_phase, sp.tsp_plan_phase, 'prelaunch') AS plan_phase,
         up.tup_sponsorship_number, up.tup_first_name, up.tup_last_name, u.tu_email
  INTO v_payment
  FROM public.tbl_payments p
  JOIN public.tbl_user_subscriptions us ON us.tus_id = p.tp_subscription_id
  JOIN public.tbl_subscription_plans sp ON sp.tsp_id = us.tus_plan_id
  JOIN public.tbl_users u ON u.tu_id = p.tp_user_id
  LEFT JOIN public.tbl_user_profiles up ON up.tup_user_id = u.tu_id
  WHERE p.tp_id = p_payment_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'payment_not_found'); END IF;
  IF v_payment.tp_payment_status <> 'completed' THEN RETURN jsonb_build_object('success', false, 'reason', 'payment_not_completed'); END IF;
  IF v_payment.plan_phase <> 'launch' THEN RETURN jsonb_build_object('success', false, 'reason', 'not_launch_plan'); END IF;

  v_plan_amount := COALESCE(v_payment.tus_payment_amount, v_payment.tsp_price, v_payment.tp_amount, 0);
  v_offer_amount := public.get_active_direct_income_offer('launch');
  v_joined_label := COALESCE(NULLIF(trim(v_payment.tup_sponsorship_number), ''), NULLIF(trim(concat_ws(' ', v_payment.tup_first_name, v_payment.tup_last_name)), ''), NULLIF(trim(v_payment.tu_email), ''), v_payment.tp_user_id::text);

  FOR v_level, v_recipient_id, v_percent, v_required_directs IN
    WITH RECURSIVE uplines AS (
      SELECT 1 AS level, parent.tu_id AS recipient_user_id
      FROM public.tbl_users joined JOIN public.tbl_users parent ON parent.tu_id = joined.tu_referrer_id
      WHERE joined.tu_id = v_payment.tp_user_id
      UNION ALL
      SELECT u.level + 1, parent.tu_id
      FROM uplines u
      JOIN public.tbl_users upline ON upline.tu_id = u.recipient_user_id
      JOIN public.tbl_users parent ON parent.tu_id = upline.tu_referrer_id
      WHERE u.level < 3
    )
    SELECT level, recipient_user_id,
           CASE level WHEN 1 THEN 7.0 WHEN 2 THEN 1.5 WHEN 3 THEN 1.0 END::numeric(9,6),
           CASE level WHEN 1 THEN 0 WHEN 2 THEN 3 WHEN 3 THEN 9 END
    FROM uplines ORDER BY level
  LOOP
    v_direct_count := public.count_paid_direct_joins(v_recipient_id);
    v_requested_amount := ROUND((v_plan_amount * v_percent / 100)::numeric, 6);
    IF v_level = 1 AND v_offer_amount IS NOT NULL THEN
      v_requested_amount := v_offer_amount;
      v_percent := CASE WHEN v_plan_amount > 0 THEN ROUND((v_offer_amount * 100 / v_plan_amount)::numeric, 6) ELSE 0 END;
    END IF;

    SELECT subscription_id INTO v_recipient_subscription_id
    FROM public.get_user_active_working_income_subscription(v_recipient_id) LIMIT 1;

    IF v_recipient_subscription_id IS NULL OR NOT public.is_valid_working_income_customer(v_recipient_id) THEN
      INSERT INTO public.tbl_joining_commissions (tjc_payment_id, tjc_subscription_id, tjc_joined_user_id, tjc_recipient_user_id, tjc_level, tjc_plan_amount, tjc_percentage, tjc_commission_amount, tjc_required_direct_joins, tjc_direct_joins_at_award, tjc_status, tjc_skip_reason, tjc_recipient_subscription_id)
      VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, v_recipient_id, v_level, v_plan_amount, v_percent, v_requested_amount, v_required_directs, v_direct_count, 'locked', 'no_active_earning_package', v_recipient_subscription_id)
      ON CONFLICT (tjc_payment_id, tjc_level, tjc_recipient_user_id) DO NOTHING;
      v_locked_count := v_locked_count + 1; CONTINUE;
    END IF;

    IF v_direct_count < v_required_directs THEN
      INSERT INTO public.tbl_joining_commissions (tjc_payment_id, tjc_subscription_id, tjc_joined_user_id, tjc_recipient_user_id, tjc_level, tjc_plan_amount, tjc_percentage, tjc_commission_amount, tjc_required_direct_joins, tjc_direct_joins_at_award, tjc_status, tjc_skip_reason, tjc_recipient_subscription_id)
      VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, v_recipient_id, v_level, v_plan_amount, v_percent, v_requested_amount, v_required_directs, v_direct_count, 'locked', 'direct_join_requirement_not_met', v_recipient_subscription_id)
      ON CONFLICT (tjc_payment_id, tjc_level, tjc_recipient_user_id) DO NOTHING;
      v_locked_count := v_locked_count + 1; CONTINUE;
    END IF;

    v_amount := public.cap_subscription_working_credit(v_recipient_subscription_id, v_requested_amount);
    IF v_amount <= 0 THEN
      PERFORM public.mark_subscription_exhausted_if_needed(v_recipient_subscription_id);
      INSERT INTO public.tbl_joining_commissions (tjc_payment_id, tjc_subscription_id, tjc_joined_user_id, tjc_recipient_user_id, tjc_level, tjc_plan_amount, tjc_percentage, tjc_commission_amount, tjc_required_direct_joins, tjc_direct_joins_at_award, tjc_status, tjc_skip_reason, tjc_recipient_subscription_id)
      VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, v_recipient_id, v_level, v_plan_amount, v_percent, 0, v_required_directs, v_direct_count, 'skipped', 'working_5x_limit_reached', v_recipient_subscription_id)
      ON CONFLICT (tjc_payment_id, tjc_level, tjc_recipient_user_id) DO NOTHING;
      v_skipped_count := v_skipped_count + 1; CONTINUE;
    END IF;

    INSERT INTO public.tbl_joining_commissions (tjc_payment_id, tjc_subscription_id, tjc_joined_user_id, tjc_recipient_user_id, tjc_level, tjc_plan_amount, tjc_percentage, tjc_commission_amount, tjc_required_direct_joins, tjc_direct_joins_at_award, tjc_status, tjc_recipient_subscription_id)
    VALUES (p_payment_id, v_payment.tp_subscription_id, v_payment.tp_user_id, v_recipient_id, v_level, v_plan_amount, v_percent, v_amount, v_required_directs, v_direct_count, 'credited', v_recipient_subscription_id)
    ON CONFLICT (tjc_payment_id, tjc_level, tjc_recipient_user_id) DO NOTHING
    RETURNING tjc_id INTO v_commission_id;
    IF v_commission_id IS NULL THEN CONTINUE; END IF;

    v_wallet_id := public.ensure_working_wallet(v_recipient_id);
    INSERT INTO public.tbl_wallet_transactions (twt_wallet_id, twt_user_id, twt_transaction_type, twt_amount, twt_description, twt_status, twt_reference_type, twt_reference_id, twt_created_at)
    VALUES (v_wallet_id, v_recipient_id, 'credit', v_amount,
      CASE WHEN v_level = 1 AND v_offer_amount IS NOT NULL THEN 'Promotional direct joining commission from ' ELSE 'Level ' || v_level || ' joining commission from ' END || v_joined_label,
      'completed', 'joining_commission', v_commission_id, now())
    RETURNING twt_id INTO v_wallet_tx_id;
    UPDATE public.tbl_wallets SET tw_balance = COALESCE(tw_balance, 0) + v_amount, tw_updated_at = now() WHERE tw_id = v_wallet_id;
    UPDATE public.tbl_joining_commissions SET tjc_wallet_transaction_id = v_wallet_tx_id WHERE tjc_id = v_commission_id;
    PERFORM public.mark_subscription_exhausted_if_needed(v_recipient_subscription_id);
    v_credited_total := v_credited_total + v_amount;
    v_credit_count := v_credit_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'credited_count', v_credit_count, 'locked_count', v_locked_count, 'skipped_count', v_skipped_count, 'credited_total', v_credited_total, 'offer_applied', v_offer_amount IS NOT NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_launch_joining_commissions_for_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_launch_joining_commissions_for_payment(uuid) TO service_role;

DROP POLICY IF EXISTS "system_settings_public_safe_select" ON public.tbl_system_settings;
CREATE POLICY "system_settings_public_safe_select"
  ON public.tbl_system_settings FOR SELECT TO anon, authenticated
  USING (tss_setting_key IN (
    'site_name','logo_url','date_format','timezone','maintenance_mode','maintenance_message',
    'maintenance_notice_enabled','maintenance_notice_message','maintenance_window_start_at','maintenance_window_end_at','maintenance_allowed_ips',
    'contact_email','contact_email_note','contact_phone','contact_phone_note','contact_address','contact_business_hours','contact_quick_support_links',
    'social_facebook_url','social_twitter_url','social_linkedin_url','social_instagram_url','social_youtube_url','social_whatsapp_url',
    'after_launch_plan_config','home_autopool_popup_enabled','direct_income_offer_config','launch_phase','site_mode','captcha_verification_enabled',
    'email_verification_required','mobile_verification_required','either_verification_required','referral_mandatory','customer_email_unique','customer_mobile_unique',
    'job_seeker_video_url','job_provider_video_url','username_min_length','username_max_length','username_allow_spaces','username_allow_special_chars',
    'username_allowed_special_chars','username_force_lower_case','username_unique_required','username_allow_numbers','username_must_start_with_letter',
    'password_min_length','password_max_length','password_require_uppercase','password_require_lowercase','password_require_numbers','password_require_special_chars',
    'password_allowed_special_chars','password_prevent_common','password_prevent_sequences','password_prevent_repeats','password_max_consecutive','password_min_unique_chars',
    'payment_mode','usdt_address','usdt_address_testnet','usdt_address_mainnet','admin_payment_wallet','admin_payment_wallet_testnet','admin_payment_wallet_mainnet',
    'payment_wallets_enabled','withdrawal_enabled','withdrawal_disabled_message','withdrawal_min_amount','reward_withdrawal_min_amount','autopool_withdrawal_min_amount',
    'withdrawal_step_amount','withdrawal_commission_percent','withdrawal_auto_transfer','withdrawal_processing_days'
  ));

NOTIFY pgrst, 'reload schema';
