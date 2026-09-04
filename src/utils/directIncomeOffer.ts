export type DirectIncomeOfferPlan = 'autopool' | 'launch';

export type DirectIncomeOffer = {
  enabled: boolean;
  amount: number;
  startAt: string;
  endAt: string;
};

export type DirectIncomeOfferConfig = Record<DirectIncomeOfferPlan, DirectIncomeOffer>;

export const defaultDirectIncomeOfferConfig: DirectIncomeOfferConfig = {
  autopool: { enabled: false, amount: 4, startAt: '', endAt: '' },
  launch: { enabled: false, amount: 4, startAt: '', endAt: '' },
};

export const normalizeDirectIncomeOfferConfig = (value: unknown): DirectIncomeOfferConfig => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalize = (plan: DirectIncomeOfferPlan): DirectIncomeOffer => {
    const candidate = raw[plan];
    const offer = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
    const amount = Number(offer.amount);
    return {
      enabled: offer.enabled === true,
      amount: Number.isFinite(amount) && amount >= 0 ? amount : defaultDirectIncomeOfferConfig[plan].amount,
      startAt: String(offer.startAt || '').trim(),
      endAt: String(offer.endAt || '').trim(),
    };
  };

  return { autopool: normalize('autopool'), launch: normalize('launch') };
};

export const isDirectIncomeOfferActive = (offer: DirectIncomeOffer | null | undefined, now = new Date()) => {
  if (!offer?.enabled || !Number.isFinite(Number(offer.amount)) || Number(offer.amount) <= 0) return false;
  const start = new Date(offer.startAt).getTime();
  const end = new Date(offer.endAt).getTime();
  const current = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= current && current <= end;
};

export const formatOfferDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
