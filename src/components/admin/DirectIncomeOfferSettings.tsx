import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Save } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { adminApi } from '../../lib/adminApi';
import { useNotification } from '../ui/NotificationProvider';
import {
  DirectIncomeOfferConfig,
  DirectIncomeOfferPlan,
  defaultDirectIncomeOfferConfig,
  normalizeDirectIncomeOfferConfig,
} from '../../utils/directIncomeOffer';

const toLocalInput = (value: string) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIso = (value: string) => value ? new Date(value).toISOString() : '';

const DirectIncomeOfferSettings: React.FC = () => {
  const { settings, updateSettings, refreshSettings } = useAdmin();
  const notification = useNotification();
  const initial = useMemo(
    () => normalizeDirectIncomeOfferConfig(settings.directIncomeOfferConfig),
    [settings.directIncomeOfferConfig],
  );
  const [form, setForm] = useState<DirectIncomeOfferConfig>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  const updateOffer = (plan: DirectIncomeOfferPlan, patch: Partial<DirectIncomeOfferConfig[DirectIncomeOfferPlan]>) => {
    setForm((previous) => ({ ...previous, [plan]: { ...previous[plan], ...patch } }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    for (const plan of ['autopool', 'launch'] as DirectIncomeOfferPlan[]) {
      const offer = form[plan];
      if (!offer.enabled) continue;
      if (!Number.isFinite(offer.amount) || offer.amount <= 0) {
        notification.showError('Validation', `${plan === 'autopool' ? 'AutoPool' : 'Launch'} offer amount must be greater than zero.`);
        return;
      }
      if (!offer.startAt || !offer.endAt || new Date(offer.startAt) >= new Date(offer.endAt)) {
        notification.showError('Validation', `${plan === 'autopool' ? 'AutoPool' : 'Launch'} offer needs a valid start and end date.`);
        return;
      }
    }

    setSaving(true);
    try {
      await adminApi.post('admin-upsert-settings', {
        updates: [{
          key: 'direct_income_offer_config',
          value: form,
          description: 'Date-bound promotional direct-income overrides for AutoPool and Launch plans',
        }],
      });
      updateSettings({ directIncomeOfferConfig: form });
      await refreshSettings();
      notification.showSuccess('Saved', 'Direct-income offers updated.');
    } catch (error: unknown) {
      notification.showError('Save failed', error instanceof Error ? error.message : 'Unable to update direct-income offers.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-3"><Gift className="h-6 w-6 text-amber-700" /></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Direct Income Offers</h3>
            <p className="text-sm text-gray-600">Temporarily replace normal direct income during an exact date range. Outside the range, standard plan rules apply automatically.</p>
          </div>
        </div>
      </div>

      {(['autopool', 'launch'] as DirectIncomeOfferPlan[]).map((plan) => {
        const offer = form[plan] || defaultDirectIncomeOfferConfig[plan];
        const title = plan === 'autopool' ? 'AutoPool Matrix' : 'Launch Plan';
        return (
          <div key={plan} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-gray-900">{title} offer</h4>
                <p className="mt-1 text-xs text-gray-500">{plan === 'autopool' ? 'Overrides the normal 2 USDT parent income.' : 'Overrides first-level (direct sponsor) income with a fixed USDT amount.'}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={offer.enabled} onChange={(e) => updateOffer(plan, { enabled: e.target.checked })} />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Direct income (USDT)</label>
                <input type="number" min="0.01" max={plan === 'autopool' ? 20 : undefined} step="0.01" value={offer.amount} onChange={(e) => updateOffer(plan, { amount: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Starts</label>
                <input type="datetime-local" value={toLocalInput(offer.startAt)} onChange={(e) => updateOffer(plan, { startAt: toIso(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Ends</label>
                <input type="datetime-local" value={toLocalInput(offer.endAt)} onChange={(e) => updateOffer(plan, { endAt: toIso(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>
        );
      })}

      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Offers'}
      </button>
    </form>
  );
};

export default DirectIncomeOfferSettings;
