import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { formatOfferDate, isDirectIncomeOfferActive } from '../utils/directIncomeOffer';
import { 
  ArrowRight, 
  Users, 
  TrendingUp, 
  Shield, 
  Award, 
  Sparkles, 
  Zap, 
  Globe,
  ChevronLeft,
  ChevronRight,
  Play,
  Star,
  CheckCircle,
  Target,
  Rocket,
  DollarSign,
  X
} from 'lucide-react';

type PromoCompany = {
  name: string;
  domain: string;
};

const buildCompanyLogoUrls = (domain: string) => {
  const safeDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return {
    primary: (size: number) => `https://logo.clearbit.com/${safeDomain}?size=${size}`,
    fallback: (size: number) =>
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(safeDomain)}&sz=${size}`,
  };
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]).join('');
  return (letters || name.trim().slice(0, 2) || 'CO').toUpperCase();
};

const HOME_AUTOPOOL_POPUP_DISMISSED_KEY = 'home_autopool_popup_dismissed_date';
const HOME_LAUNCH_POPUP_DISMISSED_KEY = 'home_launch_offer_popup_dismissed_date';

const getLocalDateKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const PromoCompanyLogo: React.FC<{ company: PromoCompany }> = ({ company }) => {
  const urls = buildCompanyLogoUrls(company.domain);
  const [src, setSrc] = useState<string>(urls.primary(256));
  const [usedFallback, setUsedFallback] = useState(false);
  const isUsingFallback = usedFallback;

  const handleError = () => {
    if (!usedFallback) {
      setUsedFallback(true);
      setSrc(urls.fallback(256));
      return;
    }
    setSrc('');
  };

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div
        className="flex items-center justify-center"
        title={company.name}
        aria-label={company.name}
      >
        {src ? (
          <img
            src={src}
            srcSet={
              isUsingFallback
                ? `${urls.fallback(64)} 64w, ${urls.fallback(128)} 128w, ${urls.fallback(256)} 256w`
                : `${urls.primary(128)} 128w, ${urls.primary(256)} 256w, ${urls.primary(512)} 512w`
            }
            sizes="72px"
            alt={company.name}
            className="h-14 w-14 object-contain"
            width={56}
            height={56}
            loading="lazy"
            onError={handleError}
          />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white flex items-center justify-center font-bold">
            {getInitials(company.name)}
          </div>
        )}
      </div>
      <div className="mt-3 text-center text-xs font-semibold text-gray-700 line-clamp-1">
        {company.name}
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { settings, loading: settingsLoading } = useAdmin();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showAutopoolPopup, setShowAutopoolPopup] = useState(false);
  const [showLaunchPopup, setShowLaunchPopup] = useState(false);
  const autopoolOffer = settings.directIncomeOfferConfig?.autopool;
  const launchOffer = settings.directIncomeOfferConfig?.launch;
  const autopoolOfferActive = isDirectIncomeOfferActive(autopoolOffer);
  const launchOfferActive = isDirectIncomeOfferActive(launchOffer);

  useEffect(() => {
    if (settingsLoading) return;

    if (settings.homeAutopoolPopupEnabled === false) {
      setShowAutopoolPopup(false);
      return;
    }

    try {
      const dismissedDate = localStorage.getItem(HOME_AUTOPOOL_POPUP_DISMISSED_KEY);
      setShowAutopoolPopup(dismissedDate !== getLocalDateKey());
    } catch {
      setShowAutopoolPopup(true);
    }
  }, [settings.homeAutopoolPopupEnabled, settingsLoading]);

  useEffect(() => {
    if (settingsLoading || !launchOfferActive) {
      setShowLaunchPopup(false);
      return;
    }
    try {
      setShowLaunchPopup(localStorage.getItem(HOME_LAUNCH_POPUP_DISMISSED_KEY) !== getLocalDateKey());
    } catch {
      setShowLaunchPopup(true);
    }
  }, [launchOfferActive, settingsLoading]);

  const dismissAutopoolPopup = () => {
    try {
      localStorage.setItem(HOME_AUTOPOOL_POPUP_DISMISSED_KEY, getLocalDateKey());
    } catch {
      // Continue closing the popup if browser storage is unavailable.
    }
    setShowAutopoolPopup(false);
  };

  const dismissLaunchPopup = () => {
    try {
      localStorage.setItem(HOME_LAUNCH_POPUP_DISMISSED_KEY, getLocalDateKey());
    } catch {
      // Continue closing the popup if browser storage is unavailable.
    }
    setShowLaunchPopup(false);
  };

  const exampleCouponCompanies: PromoCompany[] = [
    { name: 'Shufersal', domain: 'shufersal.co.il' },
    { name: 'Super-Pharm', domain: 'super-pharm.co.il' },
    { name: "McDonald's", domain: 'mcdonalds.com' },
    { name: 'Starbucks', domain: 'starbucks.com' },
    { name: 'KFC', domain: 'kfc.com' },
    { name: 'FOX', domain: 'fox.co.il' },
    { name: 'Castro', domain: 'castro.com' },
    { name: 'Terminal X', domain: 'terminalx.com' },
    { name: 'Nike', domain: 'nike.com' },
    { name: 'Adidas', domain: 'adidas.com' },
    { name: 'H&M', domain: 'hm.com' },
    { name: 'Isracard', domain: 'isracard.co.il' },
  ];

  const slides = [
    {
      id: 1,
      image: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
      title: 'Promote Coupons. Grow Faster.',
      subtitle: 'A platform built for brands and communities',
      description: 'Companies publish promotional coupons to reach new customers. Customers engage with campaigns and earn rewards where eligible.',
      cta: 'Join as Customer',
      ctaLink: '/customer/register'
    },
    {
      id: 2,
      image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
      title: 'Earn by Engaging with Promotions',
      subtitle: 'Verified activity, transparent rewards',
      description: 'Discover offers, scratch/unlock promotional coupons, complete simple engagement steps, and track rewards in your wallet.',
      cta: 'Get Started',
      ctaLink: '/customer/register'
    },
    {
      id: 3,
      image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
      title: 'Referral-Powered Growth',
      subtitle: 'Invite friends and build your network',
      description: 'Customers can invite others to register. When your referrals participate, you can unlock additional rewards under program rules.',
      cta: 'Join as Company',
      ctaLink: '/company/register'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (loading) return;

    try {
      const rawLastRoute =
        sessionStorage.getItem('last_customer_route') ||
        localStorage.getItem('last_customer_route');
      if (!rawLastRoute) return;

      const lastRoute = JSON.parse(rawLastRoute) as { path?: string; savedAt?: number };
      const isRecent = Number(lastRoute.savedAt || 0) > Date.now() - 30 * 60 * 1000;
      if (!isRecent || lastRoute.path !== '/registration-payment') return;

      const hasPendingRegistrationPayment =
        Boolean(sessionStorage.getItem('registration_payment_pending_tx')) ||
        Boolean(localStorage.getItem('registration_payment_pending_tx')) ||
        Boolean(sessionStorage.getItem('registration_payment_recovery_attempt')) ||
        Boolean(localStorage.getItem('registration_payment_recovery_attempt'));

      if (!hasPendingRegistrationPayment) {
        sessionStorage.removeItem('last_customer_route');
        localStorage.removeItem('last_customer_route');
        return;
      }

      if (!user) {
        sessionStorage.removeItem('last_customer_route');
        localStorage.removeItem('last_customer_route');
        return;
      }

      if (user.userType !== 'customer') return;

      const emailRequired = settings.emailVerificationRequired === true;
      const mobileRequired = settings.mobileVerificationRequired === true;
      const eitherRequired = settings.eitherVerificationRequired === true;
      const verificationComplete = eitherRequired
        ? user.emailVerified || user.mobileVerified
        : (!emailRequired || user.emailVerified) && (!mobileRequired || user.mobileVerified);
      const paymentRoute = (settings.launchPhase || 'prelaunch') === 'launched'
        ? '/subscription-plans'
        : '/registration-payment';
      const target = user.hasActiveSubscription || user.registrationPaid
        ? '/customer/dashboard'
        : verificationComplete
          ? paymentRoute
          : '/verify-otp';

      navigate(target, {
        replace: true
      });
    } catch {
      // ignore malformed route restore data
    }
  }, [loading, navigate, settings, user]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="min-h-screen">
      {showAutopoolPopup && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="autopool-offer-title">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-300/60 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-8 text-white shadow-2xl">
            <button
              type="button"
              onClick={dismissAutopoolPopup}
              aria-label="Close offer"
              className="absolute right-4 top-4 rounded-full p-2 text-emerald-100 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-slate-950">
              <Sparkles className="h-4 w-4" />
              New Bumper Offer
            </div>
            <h2 id="autopool-offer-title" className="text-3xl font-black leading-tight sm:text-4xl">
              20 USDT Matrix Plan
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-emerald-50">
              Join the separate eight-level AutoPool matrix with a one-time 20 USDT subscription.
            </p>
            {autopoolOfferActive && autopoolOffer && (
              <div className="mt-5 rounded-2xl border border-amber-300/50 bg-amber-300/15 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Limited-time direct income</div>
                <div className="mt-1 text-3xl font-black text-white">{autopoolOffer.amount} USDT</div>
                <p className="mt-1 text-sm text-amber-50">Earned by the eligible direct parent for each AutoPool purchase through {formatOfferDate(autopoolOffer.endAt)}.</p>
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {['Separate matrix', 'Top-to-bottom placement', 'Eight levels', 'Add-on eligible'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-emerald-50">
                  <CheckCircle className="h-4 w-4 shrink-0 text-lime-300" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/upcoming-plan#autopool-20-matrix"
                onClick={dismissAutopoolPopup}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-center font-extrabold text-slate-950 transition hover:from-amber-300 hover:to-orange-400"
              >
                View Plan
              </Link>
              <button
                type="button"
                onClick={dismissAutopoolPopup}
                className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Maybe Later
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-emerald-100/70">This popup will stay hidden for the rest of today after closing.</p>
          </div>
        </div>
      )}
      {!showAutopoolPopup && showLaunchPopup && launchOfferActive && launchOffer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="launch-offer-title">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-indigo-300/60 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl">
            <button type="button" onClick={dismissLaunchPopup} aria-label="Close offer" className="absolute right-4 top-4 rounded-full p-2 text-indigo-100 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-slate-950"><Sparkles className="h-4 w-4" /> Launch Plan Offer</div>
            <h2 id="launch-offer-title" className="text-3xl font-black leading-tight sm:text-4xl">Earn {launchOffer.amount} USDT Direct Income</h2>
            <p className="mt-4 text-lg leading-relaxed text-indigo-50">During this limited-time offer, an eligible direct sponsor receives a fixed {launchOffer.amount} USDT on each qualifying Launch plan purchase.</p>
            <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-indigo-50">Valid from {formatOfferDate(launchOffer.startAt)} through {formatOfferDate(launchOffer.endAt)}.</div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/upcoming-plan" onClick={dismissLaunchPopup} className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-center font-extrabold text-slate-950 transition hover:from-amber-300 hover:to-orange-400">View Launch Plan</Link>
              <button type="button" onClick={dismissLaunchPopup} className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10">Maybe Later</button>
            </div>
          </div>
        </div>
      )}
      {/* Hero Slider Section */}
      <section className="relative h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${slide.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
            </div>
          ))}
        </div>

        {/* Slider Content */}
        <div className="relative z-10 h-full flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-3xl">
              <div className="mb-6">
                <span className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20 text-white">
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                  <span className="text-sm font-medium">{slides[currentSlide].subtitle}</span>
                </span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                {slides[currentSlide].title}
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed">
                {slides[currentSlide].description}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to={slides[currentSlide].ctaLink}
                  className="group bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white px-8 py-4 rounded-2xl font-semibold hover:from-emerald-600 hover:via-teal-700 hover:to-cyan-700 transition-all duration-300 flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <span>{slides[currentSlide].cta}</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button 
                  className="group border-2 border-white/30 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white hover:text-gray-900 transition-all duration-300 flex items-center justify-center space-x-3 backdrop-blur-sm"
                  onClick={() => {
                    const element = document.getElementById('features-section');
                    element?.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start',
                      inline: 'nearest'
                    });
                  }}
                >
                  <Play className="h-5 w-5" />
                  <span>Learn More</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slider Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex space-x-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20 bg-white/10 backdrop-blur-sm border border-white/20 text-white p-3 rounded-full hover:bg-white/20 transition-all duration-300"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 bg-white/10 backdrop-blur-sm border border-white/20 text-white p-3 rounded-full hover:bg-white/20 transition-all duration-300"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </section>

      {/* Stats Banner */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            <div className="group">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform">50K+</div>
              <div className="text-lg opacity-90">Active Members</div>
            </div>
            <div className="group">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform">$2M+</div>
              <div className="text-lg opacity-90">Rewards Paid</div>
            </div>
            <div className="group">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform">150+</div>
              <div className="text-lg opacity-90">Countries</div>
            </div>
            <div className="group">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform">99.9%</div>
              <div className="text-lg opacity-90">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Purpose */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 rounded-full px-6 py-3 mb-6">
              <Target className="h-5 w-5 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-700">Our Business Purpose</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Connecting Brands and Customers Through Promotions
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              {settings.siteName} is a promotional-coupon platform where companies list verified offers to expand
              their customer base. Customers discover campaigns, scratch/unlock promotional coupons, complete simple
              engagement steps, and earn rewards where eligible. Customers can also invite others to register and
              grow the community under program rules.
            </p>
          </div>

          {/* Example Coupon Companies */}
          <div className="mt-12 rounded-3xl border border-gray-100 bg-gray-50 p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Promotional Coupon Companies</h3>
                <p className="text-gray-600 mt-1">
                  Brands like these that commonly run promotional offers (Availability varies).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {exampleCouponCompanies.map((company) => (
                <PromoCompanyLogo key={company.domain} company={company} />
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Logos are displayed for identification purposes only and remain the property of their respective owners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-3xl border border-gray-100 bg-gradient-to-b from-emerald-50 to-white p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="bg-emerald-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <Globe className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">For Companies</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Register your business, publish promotional coupons with clear terms, and reach new audiences
                    through a referral-powered community.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-gradient-to-b from-cyan-50 to-white p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="bg-cyan-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-cyan-700" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">For Customers</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Explore promotions, scratch/unlock coupons, complete eligible activities, and earn rewards in your
                    wallet. Invite friends to participate and unlock additional benefits where applicable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Unique Design */}
      <section id="features-section" className="py-20 bg-gray-50 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-indigo-100 rounded-full px-6 py-3 mb-6">
              <Zap className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-600">Revolutionary Features</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Why Choose <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">{settings.siteName}</span>?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of referrals with a simple, direct network designed for transparency and growth.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Users,
                title: 'Referral Network',
                description: 'Fair and transparent direct-referral earnings with unlimited personal referrals.',
                color: 'from-emerald-500 to-teal-600',
                bgColor: 'bg-emerald-50',
                iconColor: 'text-emerald-600',
                image: 'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              },
              {
                icon: TrendingUp,
                title: 'Real-time Analytics',
                description: 'Advanced dashboard with comprehensive analytics to track your network growth and earnings.',
                color: 'from-cyan-500 to-blue-600',
                bgColor: 'bg-cyan-50',
                iconColor: 'text-cyan-600',
                image: 'https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              },
              {
                icon: Shield,
                title: 'Enterprise Security',
                description: 'Bank-grade security with multi-factor authentication and end-to-end encryption.',
                color: 'from-violet-500 to-purple-600',
                bgColor: 'bg-violet-50',
                iconColor: 'text-violet-600',
                image: 'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              },
              {
                icon: Award,
                title: 'Instant Withdrawal',
                description: 'Fast withdrawals with transparent tracking so you can access your earnings quickly.',
                color: 'from-rose-500 to-pink-600',
                bgColor: 'bg-rose-50',
                iconColor: 'text-rose-600',
                image: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              }
            ].map((feature, index) => (
              <div key={index} className="group relative">
                <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-4 overflow-hidden">
                  {/* Feature Image */}
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={feature.image} 
                      alt={feature.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </div>
                  
                  <div className="p-8 relative">
                    <div className={`${feature.bgColor} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 -mt-12 relative z-10 shadow-lg`}>
                      <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{feature.title}</h3>
                    <p className="text-gray-600 text-center leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories Banner */}
      <section className="py-20 bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop" 
            alt="Success Stories"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-8 border border-white/20">
            <Star className="h-5 w-5 text-yellow-300" />
            <span className="text-sm font-medium">Success Stories</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Join Our Success Stories
          </h2>
          <p className="text-xl mb-12 text-gray-200 max-w-3xl mx-auto">
            Thousands of entrepreneurs have transformed their lives with our platform. Your success story starts here.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              { name: "Sarah Johnson", earnings: "50,000 USDT", period: "6 months", image: "https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" },
              { name: "Michael Chen", earnings: "75,000 USDT", period: "8 months", image: "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" },
              { name: "Emma Davis", earnings: "100,000 USDT", period: "1 year", image: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" }
            ].map((story, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <img 
                  src={story.image} 
                  alt={story.name}
                  className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="text-xl font-bold mb-2">{story.name}</h3>
                <p className="text-2xl font-bold text-green-400 mb-1">{story.earnings}</p>
                <p className="text-gray-300">in {story.period}</p>
              </div>
            ))}
          </div>
          
          <Link
            to="/customer/register"
            className="inline-flex items-center space-x-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-8 py-4 rounded-2xl font-bold hover:from-emerald-300 hover:to-teal-400 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Rocket className="h-6 w-6" />
            <span>Start Your Success Story</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-purple-100 rounded-full px-6 py-3 mb-6">
              <Target className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-purple-600">Simple Process</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in just three simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                step: '1',
                title: 'Register & Verify',
                description: 'Create your account with our secure registration process and verify your identity.',
                color: 'from-emerald-500 to-teal-600',
                image: 'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              },
              {
                step: '2',
                title: 'Explore Promotions',
                description: 'Discover verified promotional coupons from multiple companies and participate in eligible activities.',
                color: 'from-cyan-500 to-blue-600',
                image: 'https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              },
              {
                step: '3',
                title: 'Earn & Invite',
                description: 'Earn rewards where eligible and invite others to register and participate under the program rules.',
                color: 'from-violet-500 to-purple-600',
                image: 'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'
              }
            ].map((step, index) => (
              <div key={index} className="text-center group relative">
                <div className="relative mb-8">
                  <div className="relative overflow-hidden rounded-2xl">
                    <img 
                      src={step.image} 
                      alt={step.title}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className={`absolute top-4 left-4 bg-gradient-to-r ${step.color} text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg`}>
                      {step.step}
                    </div>
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-32 -right-6 w-12 h-0.5 bg-gradient-to-r from-gray-300 to-transparent"></div>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop" 
            alt="Join Now"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-8 border border-white/20">
            <Sparkles className="h-5 w-5 text-yellow-300" />
            <span className="text-sm font-medium">Ready to Get Started?</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Promote Smarter. Earn Faster.
          </h2>
          <p className="text-xl mb-12 text-gray-200 max-w-3xl mx-auto">
            Join {settings.siteName} as a customer to explore promotional coupons and earn eligible rewards,
            or register your company to publish offers and grow your customer base.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Link
              to="/customer/register"
             className="group bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-8 py-4 rounded-2xl font-bold hover:from-emerald-300 hover:to-teal-400 transition-all duration-300 flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
             onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <DollarSign className="h-6 w-6" />
              <span>Join as Customer</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/company/register"
              className="group border-2 border-white/30 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white hover:text-emerald-900 transition-all duration-300 flex items-center justify-center space-x-3 backdrop-blur-sm"
             onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Rocket className="h-5 w-5" />
              <span>Join as Company</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-75">
            <div className="flex items-center justify-center space-x-2">
              <Shield className="h-6 w-6" />
              <span className="text-sm">SSL Secured</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-6 w-6" />
              <span className="text-sm">Verified Platform</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">50K+ Members</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Award className="h-6 w-6" />
              <span className="text-sm">Award Winning</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
