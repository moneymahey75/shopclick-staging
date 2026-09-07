-- A new, isolated low-entry registration product.  It intentionally does not
-- reuse the retired five-USDT plan, whose purchases are used by the legacy
-- spin-wheel upgrade promotion.

ALTER TABLE public.tbl_subscription_plans
  ADD COLUMN IF NOT EXISTS tsp_product_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_product_code
  ON public.tbl_subscription_plans (tsp_product_code)
  WHERE tsp_product_code IS NOT NULL;

DO $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT tsp_id INTO v_plan_id
  FROM public.tbl_subscription_plans
  WHERE tsp_product_code = 'registration_5_spin'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.tbl_subscription_plans (
      tsp_name, tsp_description, tsp_price, tsp_duration_days,
      tsp_coupon_days, tsp_features, tsp_parent_income, tsp_is_active,
      tsp_type, tsp_plan_phase, tsp_product_code
    ) VALUES (
      '5 USDT Spin Registration',
      'One-time registration with one Spin Wheel eligibility. No daily coupons, ROI, matrix, AutoPool, or launch commissions.',
      5.00, 0, 0,
      '["One Spin Wheel eligibility", "2 USDT direct Parent A/C income", "No daily coupons or ROI income", "No AutoPool, matrix, or launch commissions"]'::jsonb,
      2.00, true, 'registration', 'prelaunch', 'registration_5_spin'
    );
  ELSE
    UPDATE public.tbl_subscription_plans
    SET tsp_name = '5 USDT Spin Registration',
        tsp_description = 'One-time registration with one Spin Wheel eligibility. No daily coupons, ROI, matrix, AutoPool, or launch commissions.',
        tsp_price = 5.00,
        tsp_duration_days = 0,
        tsp_coupon_days = 0,
        tsp_features = '["One Spin Wheel eligibility", "2 USDT direct Parent A/C income", "No daily coupons or ROI income", "No AutoPool, matrix, or launch commissions"]'::jsonb,
        tsp_parent_income = 2.00,
        tsp_is_active = true,
        tsp_type = 'registration',
        tsp_plan_phase = 'prelaunch'
    WHERE tsp_id = v_plan_id;
  END IF;
END $$;

-- Preserve the old promotion for historic five-USDT customers, while making
-- the new product independently eligible.  The new product remains eligible
-- even after Launch has started; the historic promotion retains its original
-- "before launch upgrade" restriction.
CREATE OR REPLACE FUNCTION public.is_spin_wheel_launch_upgrade_eligible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.tbl_user_subscriptions us
      JOIN public.tbl_subscription_plans sp ON sp.tsp_id = us.tus_plan_id
      WHERE us.tus_user_id = p_user_id
        AND sp.tsp_product_code = 'registration_5_spin'
        AND us.tus_status IN ('active', 'upgraded')
        AND (us.tus_end_date IS NULL OR us.tus_end_date > now())
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.tbl_user_subscriptions us
        JOIN public.tbl_subscription_plans sp ON sp.tsp_id = us.tus_plan_id
        WHERE us.tus_user_id = p_user_id
          AND COALESCE(sp.tsp_product_code, '') <> 'registration_5_spin'
          AND COALESCE(us.tus_plan_phase, sp.tsp_plan_phase, 'prelaunch') <> 'launch'
          AND lower(COALESCE(sp.tsp_type::text, 'registration')) = 'registration'
          AND round(COALESCE(us.tus_payment_amount, sp.tsp_price, 0)::numeric, 6) = 5
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.tbl_user_subscriptions us
        JOIN public.tbl_subscription_plans sp ON sp.tsp_id = us.tus_plan_id
        WHERE us.tus_user_id = p_user_id
          AND COALESCE(us.tus_plan_phase, sp.tsp_plan_phase, 'prelaunch') = 'launch'
          AND us.tus_status IN ('active', 'upgraded')
          AND us.tus_exhausted_at IS NULL
          AND (us.tus_end_date IS NULL OR us.tus_end_date > now())
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_spin_wheel_launch_upgrade_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_spin_wheel_launch_upgrade_eligible(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
