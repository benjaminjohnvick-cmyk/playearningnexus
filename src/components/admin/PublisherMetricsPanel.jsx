import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// PublisherMetricsPanel (ADMIN) — the platform-as-publisher monetization view: the ad-supported side of the
// business. Reads the internal/admin `adMetricsReport` (scope: publisher). Surfaces the platform-level metrics
// that aren't per-advertiser — impressions served, ad revenue, eCPM, fill rate, DAU, ARPDAU, and cohort
// retention (D1/D7/D28) — plus the AI-tracked trend for each. All measured from real ad serving; below the
// data threshold it says "still gathering data". Read-only.
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (v) => Number(v || 0).toLocaleString();
const DIR = {
  up: { color: 'text-emerald-600', Icon: TrendingUp },
  down: { color: 'text-red-600', Icon: TrendingDown },
  flat: { color: 'text-gray-500', Icon: Minus },
};

export default function PublisherMetricsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const load = async (windowDays) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adMetricsReport', { scope: 'publisher', window_days: windowDays });
      setData(res && res.enabled !== false ? res : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading publisher metrics…
      </Card>
    );
  }
  if (!data || !data.publisher) {
    return (
      <Card className="p-6 text-sm text-gray-500">
        Publisher ad metrics are unavailable (the metric set may be disabled, or you may not have admin access).
      </Card>
    );
  }

  const p = data.publisher;
  const trendFor = (metric) => (data.trends || []).find((t) => t.metric === metric);
  const tiles = [
    { k: 'Impressions', v: num(p.impressions), metric: null },
    { k: 'Ad revenue', v: money(p.ad_revenue_usd), metric: null },
    { k: 'eCPM', v: money(p.ecpm_usd), metric: 'ecpm_usd' },
    { k: 'Fill rate', v: `${p.fill_rate_pct || 0}%`, metric: 'fill_rate_pct' },
    { k: 'DAU (avg/day)', v: num(p.dau), metric: null },
    { k: 'ARPDAU', v: money(p.arpdau_usd), metric: 'arpdau_usd' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">Publisher ad metrics</h3>
        <span className="text-xs text-gray-500">platform monetization · last {p.window_days}d</span>
        <div className="ml-auto flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >{d}d</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {tiles.map((t) => {
          const tr = t.metric ? trendFor(t.metric) : null;
          const dir = tr ? (DIR[tr.direction] || DIR.flat) : null;
          const DirIcon = dir?.Icon;
          return (
            <div key={t.k} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">{t.k}</div>
              <div className="text-gray-900 font-black text-lg">{t.v}</div>
              {tr && dir && (
                <div className={`text-[11px] flex items-center gap-1 ${dir.color}`}>
                  <DirIcon className="w-3 h-3" /> {tr.direction} · {tr.samples} pts
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cohort retention */}
      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Retention (cohort)</div>
        <div className="flex flex-wrap gap-3">
          {(p.retention || []).map((r) => (
            <div key={r.window_days} className="bg-gray-50 rounded-xl p-3 border border-gray-200 min-w-[92px]">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">D{r.window_days}</div>
              <div className="text-gray-900 font-black text-base">
                {r.retained_pct == null ? <span className="text-gray-400 text-xs font-medium">gathering</span> : `${r.retained_pct}%`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your business — AI social ads (platform_own_ad), measured + AI-tracked like advertisers */}
      {data.own_ad_social && (
        <div className="mt-5 pt-4 border-t border-gray-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Your business — AI social ads</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(() => {
              const s = data.own_ad_social;
              const oTrend = (m) => (data.own_ad_trends || []).find((t) => t.metric === m);
              const cells = [
                { k: 'Ads queued', v: num(s.posts), metric: null },
                { k: 'Post rate', v: `${s.post_rate_pct || 0}%`, metric: 'post_rate_pct' },
                { k: 'Reach', v: num(s.reach), metric: null },
                { k: 'Engagement rate', v: `${s.engagement_rate_pct || 0}%`, metric: 'engagement_rate_pct' },
                { k: 'Attributed rev', v: money(s.attributed_revenue_usd), metric: null },
                { k: 'Rev / 1k reach', v: money(s.rev_per_1k_reach_usd), metric: 'rev_per_1k_reach_usd' },
              ];
              return cells.map((c) => {
                const tr = c.metric ? oTrend(c.metric) : null;
                const dir = tr ? (DIR[tr.direction] || DIR.flat) : null;
                const DirIcon = dir?.Icon;
                return (
                  <div key={c.k} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">{c.k}</div>
                    <div className="text-gray-900 font-black text-lg">{c.v}</div>
                    {tr && dir && (
                      <div className={`text-[11px] flex items-center gap-1 ${dir.color}`}>
                        <DirIcon className="w-3 h-3" /> {tr.direction} · {tr.samples} pts
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">{data.own_ad_social.basis} Tracked and AI-optimized on the same self-learning loop as advertiser ads.</p>
        </div>
      )}

      <p className="text-[11px] text-gray-500 mt-4">{p.basis}</p>
      {data.disclaimer && <p className="text-[11px] text-gray-400 mt-1">{data.disclaimer}</p>}
    </Card>
  );
}
