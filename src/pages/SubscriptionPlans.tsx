import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Check, Star, Zap, DollarSign, ArrowRight, CheckCircle, Package, Calendar, Users, Shield, CreditCard, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SubscriptionPlan {
  tsp_id: string;
  tsp_name: string;
  tsp_description: string;
  tsp_price: number;
  tsp_duration_days: number;
  tsp_features: any;
  tsp_is_active: boolean;
  tsp_type?: 'registration' | 'upgrade' | null;
  tsp_plan_phase?: string | null;
  tsp_product_code?: string | null;
  tsp_created_at: string;
}

interface ActivePackage {
  tus_plan_id: string;
  tus_payment_amount: number | null;
  tus_plan_phase?: string | null;
  tus_package_kind?: 'registration' | 'upgrade' | 'renew' | null;
  tus_end_date?: string | null;
  tus_start_date?: string | null;
  tus_product_code?: string | null;
  plan?: {
    tsp_id: string;
    tsp_price: number | null;
    tsp_plan_phase?: string | null;
    tsp_product_code?: string | null;
  } | null;
}

const PAYMENT_SELECTED_PLAN_KEY = 'payment_selected_plan_state';

const savePaymentPlanSelection = (planId: string, plan?: SubscriptionPlan | null) => {
  try {
    const value = JSON.stringify({ planId, plan: plan || null, savedAt: Date.now() });
    sessionStorage.setItem(PAYMENT_SELECTED_PLAN_KEY, value);
    localStorage.setItem(PAYMENT_SELECTED_PLAN_KEY, value);
  } catch {
    // Storage can be unavailable in embedded wallet browsers.
  }
};

const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useAdmin();
  const launchPhase = (settings?.launchPhase || 'prelaunch') as 'prelaunch' | 'launched';
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingPlanId, setCheckingPlanId] = useState<string | null>(null);
  const [featuresPlan, setFeaturesPlan] = useState<SubscriptionPlan | null>(null);
  const plansSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchPhase]);

  useEffect(() => {
    loadActivePackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, launchPhase]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const normalizeFeatures = (raw: any): string[] => {
        if (Array.isArray(raw)) return raw.map((v) => String(v));
        if (raw === null || raw === undefined) return [];
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map((v) => String(v));
          } catch {
            // fallthrough
          }
          return trimmed.split(/\r?\n+/).map((v) => v.trim()).filter(Boolean);
        }
        if (typeof raw === 'object') {
          return Object.entries(raw).map(([key, value]) => {
            if (typeof value === 'string' && value.trim()) return value;
            return key.replace(/_/g, ' ');
          });
        }
        return [String(raw)];
      };

      const { data, error } = await supabase
        .from('tbl_subscription_plans')
        .select('*')
        .eq('tsp_is_active', true)
        .or('tsp_type.eq.upgrade,tsp_product_code.eq.registration_5_spin')
        .order('tsp_price', { ascending: true });

      if (error) {
        throw error;
      }
      
      const normalized = (data || []).map((row: any) => ({
        ...row,
        tsp_features: normalizeFeatures(row?.tsp_features),
      }));

      setPlans(normalized);
    } catch {
      setError('Failed to load subscription plans. Please try again.');
      // Fallback to default plans if database fails
      setPlans([
        {
          tsp_id: '1',
          tsp_name: 'Basic Plan',
          tsp_description: 'Perfect for beginners starting their referral journey',
          tsp_price: 50,
          tsp_duration_days: 30,
          tsp_features: ['Direct Referral Access', 'Basic Dashboard', 'Email Support', 'Mobile App Access'],
          tsp_is_active: true,
          tsp_created_at: new Date().toISOString()
        },
        {
          tsp_id: '2',
          tsp_name: 'Premium Plan',
          tsp_description: 'For serious entrepreneurs ready to scale',
          tsp_price: 100,
          tsp_duration_days: 30,
          tsp_features: ['Direct Referral Access', 'Advanced Dashboard', 'Priority Support', 'Analytics & Reports', 'Marketing Tools', 'API Access'],
          tsp_is_active: true,
          tsp_created_at: new Date().toISOString()
        },
        {
          tsp_id: '3',
          tsp_name: 'Enterprise Plan',
          tsp_description: 'Complete solution for enterprise-level operations',
          tsp_price: 200,
          tsp_duration_days: 30,
          tsp_features: ['Direct Referral Access', 'Advanced Dashboard', 'Priority Support', 'Analytics & Reports', 'Marketing Tools', 'API Access', 'Custom Branding', 'White Label Options'],
          tsp_is_active: true,
          tsp_created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadActivePackages = async () => {
    if (!user?.id || launchPhase !== 'launched') {
      setActivePackages([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tbl_user_subscriptions')
        .select(`
          tus_plan_id,
          tus_payment_amount,
          tus_plan_phase,
          tus_package_kind,
          tus_end_date,
          tus_start_date,
          plan:tus_plan_id(
            tsp_id,
            tsp_price,
            tsp_plan_phase,
            tsp_product_code
          )
        `)
        .eq('tus_user_id', user.id)
        .in('tus_status', ['active', 'upgraded'])
        .is('tus_exhausted_at', null);

      if (error) throw error;

      setActivePackages((data || []).map((row: any) => ({
        tus_plan_id: row.tus_plan_id,
        tus_payment_amount: row.tus_payment_amount == null ? null : Number(row.tus_payment_amount),
        tus_plan_phase: row.tus_plan_phase,
        tus_package_kind: row.tus_package_kind,
        tus_end_date: row.tus_end_date,
        tus_start_date: row.tus_start_date,
        tus_product_code: row.plan?.tsp_product_code || null,
        plan: row.plan
          ? {
              tsp_id: row.plan.tsp_id,
              tsp_price: row.plan.tsp_price == null ? null : Number(row.plan.tsp_price),
              tsp_plan_phase: row.plan.tsp_plan_phase,
              tsp_product_code: row.plan.tsp_product_code,
            }
          : null,
      })));
    } catch {
      console.warn('Failed to load active packages');
      setActivePackages([]);
    }
  };

  const normalizeAmount = (value: number | null | undefined) => Number(Number(value || 0).toFixed(6));
  const isAutopool20Plan = (plan: SubscriptionPlan) => plan.tsp_product_code === 'autopool_20';
  const isRegistrationPlan = (plan: SubscriptionPlan) => plan.tsp_type === 'registration' || plan.tsp_product_code === 'registration_5_spin';

  const scrollPlans = (direction: 'previous' | 'next') => {
    plansSliderRef.current?.scrollBy({
      left: direction === 'next' ? 420 : -420,
      behavior: 'smooth',
    });
  };

  const isActivePackageUsable = (pkg: ActivePackage) => {
    if (pkg.tus_end_date) {
      const end = new Date(pkg.tus_end_date).getTime();
      if (Number.isFinite(end) && end <= Date.now()) return false;
    }

    if (pkg.tus_start_date && pkg.tus_product_code !== 'autopool_20' && pkg.plan?.tsp_product_code !== 'autopool_20') {
      const start = new Date(pkg.tus_start_date);
      if (Number.isFinite(start.getTime())) {
        const today = new Date();
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const daysUsed = Math.floor((todayDay - startDay) / 86400000) + 1;
        if (daysUsed > 200) return false;
      }
    }

    return true;
  };

  const hasActiveSamePackage = (plan: SubscriptionPlan) => {
    const planAmount = normalizeAmount(plan.tsp_price);
    const planPhase = String(plan.tsp_plan_phase || 'prelaunch');
    const targetIsAutopool20 = isAutopool20Plan(plan);

    return activePackages.some((pkg) => {
      if (!isActivePackageUsable(pkg)) return false;
      const packageIsAutopool20 = pkg.tus_product_code === 'autopool_20' || pkg.plan?.tsp_product_code === 'autopool_20';

      if (targetIsAutopool20 || packageIsAutopool20) {
        return targetIsAutopool20 && packageIsAutopool20 && pkg.tus_plan_id === plan.tsp_id;
      }

      const packageAmount = normalizeAmount(pkg.tus_payment_amount ?? pkg.plan?.tsp_price ?? 0);
      const packagePhase = String(pkg.tus_plan_phase || pkg.plan?.tsp_plan_phase || 'prelaunch');

      return pkg.tus_plan_id === plan.tsp_id || (packagePhase === planPhase && packageAmount === planAmount);
    });
  };

  const hasHigherActivePackage = (plan: SubscriptionPlan) => {
    if (isAutopool20Plan(plan)) return false;
    const planAmount = normalizeAmount(plan.tsp_price);
    const planPhase = String(plan.tsp_plan_phase || 'prelaunch');

    return activePackages.some((pkg) => {
      if (!isActivePackageUsable(pkg)) return false;
      if (pkg.tus_product_code === 'autopool_20' || pkg.plan?.tsp_product_code === 'autopool_20') return false;
      const packageAmount = normalizeAmount(pkg.tus_payment_amount ?? pkg.plan?.tsp_price ?? 0);
      const packagePhase = String(pkg.tus_plan_phase || pkg.plan?.tsp_plan_phase || 'prelaunch');
      return packagePhase === planPhase && packageAmount > planAmount;
    });
  };

  const handleSelectPlan = async (planId: string) => {
    const selectedPlan = plans.find(p => p.tsp_id === planId);

    if (selectedPlan && isRegistrationPlan(selectedPlan)) {
      if (user?.registrationPaid) {
        alert('The 5 USDT registration plan is available only for new accounts. Your registration is already complete.');
        return;
      }

      navigate(user ? '/registration-payment' : '/customer/register');
      return;
    }

    if (selectedPlan && hasActiveSamePackage(selectedPlan)) {
      alert('You already have an active package for this plan. You can renew it after the current package is exhausted.');
      return;
    }

    if (selectedPlan && hasHigherActivePackage(selectedPlan)) {
      alert('You cannot buy a lower package while a higher package is still active. Choose a higher package, or wait until the higher package is exhausted.');
      return;
    }
    
    if (!user) {
      savePaymentPlanSelection(planId, selectedPlan);
      navigate('/customer/login', { 
        state: { 
          from: '/payment', 
          selectedPlanId: planId,
          returnToPayment: true
        } 
      });
      return;
    }

    try {
      setCheckingPlanId(planId);
      const { data, error } = await supabase.rpc('can_purchase_subscription_plan', {
        p_user_id: user.id,
        p_plan_id: planId,
      });

      if (error) throw error;

      const result = (data || {}) as { allowed?: boolean; message?: string };
      if (result.allowed === false) {
        alert(result.message || 'This package cannot be purchased right now.');
        await loadActivePackages();
        return;
      }
    } catch (error: any) {
      console.warn('Failed to validate plan purchase');
      alert(error?.message || 'Unable to validate this package purchase. Please try again.');
      return;
    } finally {
      setCheckingPlanId(null);
    }
    
    savePaymentPlanSelection(planId, selectedPlan);
    navigate('/payment', { 
      state: { 
        selectedPlanId: planId, 
        fromPlanSelection: true,
        selectedPlan
      } 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading subscription plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-indigo-100 rounded-full px-6 py-3 mb-6">
            <Package className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-600">USDT Subscription Plans</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Choose Your <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">USDT Plan</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            {user 
              ? 'Select the perfect USDT subscription plan to unlock your referral dashboard and start earning.'
              : 'Explore our USDT subscription plans. Login to purchase and start your referral journey.'
            }
          </p>
          
          {/* USDT Payment Info */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <CreditCard className="h-6 w-6" />
              <h3 className="text-xl font-bold">Secure USDT Payments</h3>
              <Shield className="h-6 w-6" />
            </div>
            <p className="text-green-100">
              All payments are processed in USDT (BEP-20) on BNB Smart Chain for instant, secure, and transparent transactions.
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 max-w-2xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Package className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-800">Unable to Load Plans</h3>
                <p className="text-red-700">{error}</p>
                <p className="text-sm text-red-600 mt-2">Showing default plans below.</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment plans slider */}
        {plans.length > 0 ? (
          <div className="relative max-w-[1600px] mx-auto">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-gray-600">Swipe or use the arrows to view every payment plan.</p>
              <div className="hidden sm:flex items-center gap-2">
                <button type="button" onClick={() => scrollPlans('previous')} className="rounded-full border border-indigo-200 bg-white p-2 text-indigo-700 shadow-sm transition hover:bg-indigo-50" aria-label="Previous plans">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => scrollPlans('next')} className="rounded-full border border-indigo-200 bg-white p-2 text-indigo-700 shadow-sm transition hover:bg-indigo-50" aria-label="Next plans">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div ref={plansSliderRef} className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-2 pb-6 pt-5 scroll-smooth [scrollbar-width:thin]">
            {plans.map((plan, index) => {
              const isAutopool20 = isAutopool20Plan(plan);
              const registrationPlan = isRegistrationPlan(plan);
              const isPopularPlan = plan.tsp_price === 50 && !isAutopool20 && !registrationPlan;
              const alreadyActive = hasActiveSamePackage(plan);
              const blockedByHigherPackage = hasHigherActivePackage(plan);

              return (
              <div
                key={plan.tsp_id}
                className={`min-w-[min(100%,360px)] sm:min-w-[360px] snap-start bg-white rounded-2xl shadow-xl border-2 p-6 relative transform transition-all duration-300 ${
                  alreadyActive || blockedByHigherPackage
                    ? 'border-emerald-300 opacity-75'
                    : isPopularPlan
                      ? 'border-indigo-500 ring-4 ring-indigo-200 hover:scale-105 hover:shadow-2xl'
                      : 'border-gray-200 hover:border-indigo-300 hover:scale-105 hover:shadow-2xl'
                }`}
              >
                {/* Popular Badge */}
                {alreadyActive || blockedByHigherPackage ? (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-emerald-600 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-lg">
                      <CheckCircle className="h-4 w-4" />
                      <span>{alreadyActive ? 'Active Package' : 'Lower Package'}</span>
                    </div>
                  </div>
                ) : registrationPlan ? (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-lg">
                      <Star className="h-4 w-4" />
                      <span>New Registration</span>
                    </div>
                  </div>
                ) : isPopularPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-lg">
                      <Star className="h-4 w-4" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    index === 0 ? 'bg-blue-100' : index === 1 ? 'bg-indigo-100' : 'bg-purple-100'
                  }`}>
                    <Package className={`h-8 w-8 ${
                      index === 0 ? 'text-blue-600' : index === 1 ? 'text-indigo-600' : 'text-purple-600'
                    }`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.tsp_name}</h3>
                  {isAutopool20 && <div className="text-sm font-semibold text-emerald-700 mb-2">Separate add-on matrix plan</div>}
                  
                  {/* USDT Price Display - Same as admin panel */}
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.tsp_price}</span>
                    <span className="text-2xl font-bold text-indigo-600 ml-2">USDT</span>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{registrationPlan ? 'One-time new-account registration' : isAutopool20 ? 'Eight-level matrix placement' : 'Up to 200 days earning window'}</span>
                  </div>
                  
                  <p className="text-gray-600 mt-3">{plan.tsp_description}</p>
                </div>

                {/* Features List - Same as admin panel */}
                <div className="space-y-4 mb-8">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Included Features:
                  </h4>
                  {plan.tsp_features.slice(0, 2).map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                      <div className="bg-green-100 rounded-full p-1 flex-shrink-0">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{feature}</span>
                    </div>
                  ))}
                  {plan.tsp_features.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setFeaturesPlan(plan)}
                      className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      View all features ({plan.tsp_features.length})
                    </button>
                  )}
                </div>

                {/* Plan Stats */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-900">{plan.tsp_price}</div>
                      <div className="text-xs text-gray-600">USDT Price</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">{registrationPlan ? 'One-time' : isAutopool20 ? '4×4' : '200'}</div>
                      <div className="text-xs text-gray-600">{registrationPlan ? 'Registration' : isAutopool20 ? 'Matrix structure' : 'Earning Days'}</div>
                    </div>
                  </div>
                </div>

                {/* Select Button */}
                <button
                  onClick={() => handleSelectPlan(plan.tsp_id)}
                  disabled={alreadyActive || blockedByHigherPackage || checkingPlanId === plan.tsp_id}
                  className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg ${
                    alreadyActive || blockedByHigherPackage || checkingPlanId === plan.tsp_id
                      ? 'cursor-not-allowed bg-emerald-100 text-emerald-800 shadow-none'
                      : isPopularPlan
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                      : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-900 hover:to-black'
                  }`}
                >
                  {alreadyActive || blockedByHigherPackage ? <CheckCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  <span>
                    {checkingPlanId === plan.tsp_id
                      ? 'Checking Package...'
                      : alreadyActive
                      ? 'Already Active'
                      : blockedByHigherPackage
                      ? 'Lower Than Active Package'
                      : registrationPlan
                      ? user
                        ? `Pay ${plan.tsp_price} USDT - Registration`
                        : `Register for ${plan.tsp_price} USDT`
                      : user 
                      ? `Pay ${plan.tsp_price} USDT - Select Plan`
                      : `Select ${plan.tsp_name} - ${plan.tsp_price} USDT`
                    }
                  </span>
                  {!alreadyActive && !blockedByHigherPackage && <ArrowRight className="h-5 w-5" />}
                </button>

                {/* Plan Benefits */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    {alreadyActive
                      ? 'Renewal opens after this package is exhausted.'
                      : blockedByHigherPackage
                      ? 'Lower package purchases are blocked while a higher package is active.'
                      : registrationPlan
                      ? '✓ New account plan • ✓ One Spin Wheel eligibility • ✓ USDT payment'
                      : isAutopool20
                      ? '✓ Add-on eligible • ✓ Separate matrix • ✓ USDT payment'
                      : '✓ Instant activation • ✓ 24/7 support • ✓ USDT payments'}
                  </p>
                </div>
              </div>
            );
            })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subscription Plans Available</h3>
            <p className="text-gray-600 mb-6">
              No active subscription plans are currently available. Please contact support.
            </p>
            {!user && (
              <div className="mt-6">
                <Link
                  to="/customer/login"
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center space-x-2"
                >
                  <span>Login to Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        )}

        {featuresPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="features-modal-title">
            <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setFeaturesPlan(null)}
                className="absolute right-4 top-4 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close features"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 id="features-modal-title" className="pr-10 text-2xl font-bold text-gray-900">{featuresPlan.tsp_name}</h2>
              <p className="mt-1 text-lg font-semibold text-indigo-600">{featuresPlan.tsp_price} USDT plan features</p>
              <div className="mt-6 space-y-3">
                {featuresPlan.tsp_features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="mt-0.5 rounded-full bg-green-100 p-1"><Check className="h-4 w-4 text-green-600" /></span>
                    <span className="font-medium text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setFeaturesPlan(null)} className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black">Close</button>
            </div>
          </div>
        )}

        {/* Why Choose USDT Section */}
        <div className="mt-20 bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-green-100 rounded-full px-6 py-3 mb-6">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-green-600">USDT Advantages</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Why We Use <span className="text-green-600">USDT</span> Payments?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the benefits of cryptocurrency payments with USDT on BNB Smart Chain.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Zap,
                title: 'Instant Transactions',
                description: 'Payments are processed instantly on the blockchain with immediate confirmation.',
                color: 'from-yellow-500 to-orange-600',
                bgColor: 'bg-yellow-50',
                iconColor: 'text-yellow-600'
              },
              {
                icon: Shield,
                title: 'Maximum Security',
                description: 'Blockchain technology ensures your payments are secure and tamper-proof.',
                color: 'from-green-500 to-emerald-600',
                bgColor: 'bg-green-50',
                iconColor: 'text-green-600'
              },
              {
                icon: DollarSign,
                title: 'Low Fees',
                description: 'Minimal transaction fees compared to traditional payment methods.',
                color: 'from-blue-500 to-cyan-600',
                bgColor: 'bg-blue-50',
                iconColor: 'text-blue-600'
              },
              {
                icon: CheckCircle,
                title: 'Transparent',
                description: 'Every transaction is recorded on the blockchain for complete transparency.',
                color: 'from-purple-500 to-pink-600',
                bgColor: 'bg-purple-50',
                iconColor: 'text-purple-600'
              }
            ].map((benefit, index) => (
              <div key={index} className="text-center group">
                <div className={`${benefit.bgColor} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  <benefit.icon className={`h-8 w-8 ${benefit.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Process */}
        <div className="mt-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Simple Payment Process</h2>
            <p className="text-xl text-indigo-100">
              Get started in just 3 easy steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Select Your Plan',
                description: 'Choose the subscription plan that best fits your goals and budget.',
                icon: Package
              },
              {
                step: '2',
                title: 'Connect Wallet',
                description: 'Connect your MetaMask or compatible wallet with USDT balance.',
                icon: CreditCard
              },
              {
                step: '3',
                title: 'Complete Payment',
                description: 'Approve the USDT transaction and get instant access to your dashboard.',
                icon: CheckCircle
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="bg-white/20 backdrop-blur-sm w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                  <step.icon className="h-8 w-8 text-white" />
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-indigo-100 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                question: "What is USDT?",
                answer: "USDT (Tether) is a stable cryptocurrency pegged to the US Dollar, providing price stability for payments."
              },
              {
                question: "Why BNB Smart Chain?",
                answer: "BNB Smart Chain offers fast transactions with low fees, making it perfect for subscription payments."
              },
              {
                question: "Is my payment secure?",
                answer: "Yes! All payments are processed through audited smart contracts on the blockchain for maximum security."
              },
              {
                question: "Can I upgrade my plan?",
                answer: "Yes, you can upgrade to a higher plan at any time. The difference will be calculated automatically."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-bold text-gray-900 mb-3">{faq.question}</h4>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        {!user && (
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl text-emerald-100 mb-8">
                Join thousands of successful entrepreneurs building their financial future.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/customer/register"
                  className="bg-white text-emerald-600 px-8 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center space-x-3"
                >
                  <Users className="h-5 w-5" />
                  <span>Register as Customer</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  to="/customer/login"
                  className="border-2 border-white text-white px-8 py-4 rounded-2xl font-bold hover:bg-white hover:text-emerald-600 transition-colors flex items-center justify-center space-x-3"
                >
                  <span>Login to Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
