import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  RefreshCw, Users, Eye, DollarSign, Share2, Wallet, TrendingUp, Sliders, Settings2, AlertCircle,
} from 'lucide-react';

// FlywheelDashboard (admin) — the live health of the profit flywheel (PROFIT-FLYWHEEL blueprint §7). Reads
// flywheelMetrics and shows the handful of numbers that say whether the wheel is spinning. Any metric that
// isn't measurable yet shows "—", never a fabricated zero.

const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString());
const fmtUsd = (v) => (v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtNum = (v, d = 2) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));

function Tile({ icon: Icon, label, value, sub, accent = 'blue' }) {
  const ring = {
    blue: 'from-blue-600 to-indigo-600', green: 'from-green-600 to-emerald-600',
    amber: 'from-amber-500 to-orange-600', violet: 'from-violet-600 to-purple-600',
  }[accent] || 'from-blue-600 to-indigo-600';
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
        <span className={`inline-flex w-6 h-6 rounded-lg bg-gradient-to-br ${ring} items-center justify-center text-white`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FlywheelDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await base44.functions.invoke('flywheelMetrics', {});
      if (res?.data?.error) setErr(res.data.error);
      else setData(res.data);
    } catch (e) { setErr(e?.message || 'Failed to load metrics'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const m = data?.metrics || {};
  const s = data?.flywheel_settings || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" /> Flywheel Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Live health of the profit flywheel — attention at the center. {data?.generated_at && (
                <span className="text-gray-400">Updated {new Date(data.generated_at).toLocaleString()}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl('ProfitOptimization')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Sliders className="w-4 h-4" /> Tune levers
            </Link>
            <button onClick={load} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {err}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile icon={Users} label="Users (total)" value={fmtInt(m.users_total)} accent="blue" />
          <Tile icon={Users} label="Engaged users (7d)" value={fmtInt(m.engaged_users_7d)} sub="distinct ad-impression users" accent="blue" />
          <Tile icon={Eye} label="Impressions today" value={fmtInt(m.ad_impressions_today)} accent="violet" />
          <Tile icon={Eye} label="Impressions (7d)" value={fmtInt(m.ad_impressions_7d)} accent="violet" />
          <Tile icon={TrendingUp} label="Impressions / engaged user" value={fmtNum(m.impressions_per_engaged_user_7d)} sub="the volume multiplier" accent="violet" />
          <Tile icon={DollarSign} label="Ad revenue (7d)" value={fmtUsd(m.ad_revenue_7d_usd)} accent="green" />
          <Tile icon={DollarSign} label="Ad revenue (all-time)" value={fmtUsd(m.ad_revenue_all_usd)} accent="green" />
          <Tile icon={Share2} label="Viral coefficient (7d)" value={fmtNum(m.viral_coefficient_7d, 3)} sub="new referrals / engaged user" accent="amber" />
          <Tile icon={Share2} label="Referrals (7d / total)" value={`${fmtInt(m.referrals_7d)} / ${fmtInt(m.referrals_total)}`} accent="amber" />
          <Tile icon={Wallet} label="Site Cash outstanding" value={fmtUsd(m.site_cash_outstanding_usd)} sub="closed-loop future demand" accent="green" />
        </div>

        <p className="text-xs text-gray-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          A dash (—) means the metric isn't measurable yet from current data — it is never shown as a fabricated zero. Windows are rolling 7-day.
        </p>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
            <Settings2 className="w-4 h-4 text-gray-500" /> Flywheel switches (live)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {[
              ['Cross-promo nudges', s.cross_promo_enabled],
              ['Self-optimizing scorer', s.cross_promo_scorer_enabled],
              ['House cross-sell fills slots', s.house_crosssell_enabled],
              ['Between-survey ads', s.survey_interstitial_enabled],
              ['In-app ads', s.in_app_ads_enabled],
            ].map(([label, on]) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-50 py-1">
                <span className="text-gray-600">{label}</span>
                <span className={`text-xs font-bold ${on ? 'text-green-600' : 'text-gray-400'}`}>{on ? 'ON' : 'OFF'}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-b border-gray-50 py-1">
              <span className="text-gray-600">In-app ad min gap</span>
              <span className="text-xs font-bold text-gray-700">{fmtNum(s.in_app_ad_min_gap_min, 0)} min</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-50 py-1">
              <span className="text-gray-600">Premium ad-free CPM</span>
              <span className="text-xs font-bold text-gray-700">{fmtUsd(s.premium_adfree_cpm_usd)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Change any of these on the <Link to={createPageUrl('ProfitOptimization')} className="text-blue-600 font-semibold">Profit Optimization</Link> panel.
          </p>
        </div>
      </div>
    </div>
  );
}
