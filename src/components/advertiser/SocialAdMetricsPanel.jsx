import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Share2, Loader2 } from 'lucide-react';

// SocialAdMetricsPanel — the full advertising metric set for the SOCIAL channel (member-amplified posts + the
// platform's own AI social ads). Reads the read-only `socialAdMetrics` endpoint. An advertiser sees their OWN
// social metrics; an admin can switch between their own, the platform's own business ads, and the all-advertiser
// leaderboard. Every figure is MEASURED from real SocialMediaPost activity — never a guaranteed result.
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (v) => Number(v || 0).toLocaleString();
const orNA = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

const SCOPES = [
  { id: 'own', label: 'My social ads' },
  { id: 'platform_own', label: "Platform's own ads" },
  { id: 'all', label: 'All advertisers' },
];

export default function SocialAdMetricsPanel({ admin = false }) {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [scope, setScope] = useState('own');

  const load = async (windowDays, sc) => {
    setLoading(true);
    try {
      const payload = { window_days: windowDays };
      if (admin) { payload.scope = sc; if (sc === 'all') payload.leaderboard = true; }
      const r = await base44.functions.invoke('socialAdMetrics', payload);
      const d = r?.data || r || {};
      if (d.enabled === false) { setData({ disabled: true, note: d.note }); setBoard(null); }
      else if (admin && sc === 'all') { setBoard(d); setData(d.totals || null); }
      else { setData(d.metrics || null); setBoard(null); }
    } catch { setData(null); setBoard(null); }
    setLoading(false);
  };

  useEffect(() => { load(days, scope); /* eslint-disable-next-line */ }, [days, scope]);

  const M = data && !data.disabled ? data : null;
  const cells = M ? [
    { k: 'Reach', v: num(M.reach) },
    { k: 'Impressions', v: num(M.impressions) },
    { k: 'Clicks', v: num(M.clicks) },
    { k: 'CTR', v: orNA(M.ctr_pct, '%') },
    { k: 'Conversions', v: num(M.conversions) },
    { k: 'CVR', v: orNA(M.cvr_pct, '%') },
    { k: 'Engagement', v: num(M.engagement) },
    { k: 'Revenue', v: money(M.revenue_usd) },
    { k: 'eCPM', v: orNA(M.ecpm_usd == null ? null : money(M.ecpm_usd)) },
    { k: 'Rev / 1k reach', v: orNA(M.rev_per_1k_reach_usd == null ? null : money(M.rev_per_1k_reach_usd)) },
    { k: 'Spend', v: money(M.spend_usd) },
    { k: 'CPM', v: orNA(M.cpm_usd == null ? null : money(M.cpm_usd)) },
    { k: 'CPP', v: orNA(M.cpp_usd == null ? null : money(M.cpp_usd)) },
    { k: 'ROAS', v: orNA(M.roas == null ? null : `${M.roas}×`) },
    { k: 'Ad value delivered', v: money(M.delivered_value_usd) },
    { k: 'Posts', v: num(M.posts) },
  ] : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-purple-600" />
          <h3 className="font-bold text-gray-900 text-sm">Social ad metrics</h3>
        </div>
        <div className="flex items-center gap-2">
          {admin && (
            <select value={scope} onChange={(e) => setScope(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1">
              {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1">
            {[7, 14, 28, 90].map((d) => <option key={d} value={d}>{d}d</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading social metrics…</div>
      ) : data?.disabled ? (
        <p className="text-xs text-gray-500">{data.note || 'Social ad metrics are disabled.'}</p>
      ) : !M ? (
        <p className="text-xs text-gray-500">No social activity in this window yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cells.map((c) => (
              <div key={c.k} className="bg-gray-50 rounded-lg px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{c.k}</div>
                <div className="text-gray-900 font-black text-base tabular-nums">{c.v}</div>
              </div>
            ))}
          </div>

          {board?.advertisers?.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-gray-700 mb-1">All advertisers — by delivered social ad value</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 text-left">
                    <th className="py-1 pr-2">Advertiser</th><th className="py-1 px-2">Posts</th><th className="py-1 px-2">Reach</th>
                    <th className="py-1 px-2">Impr.</th><th className="py-1 px-2">Rev.</th><th className="py-1 px-2">eCPM</th><th className="py-1 px-2">Value</th>
                  </tr></thead>
                  <tbody>
                    {board.advertisers.slice(0, 25).map((a) => (
                      <tr key={a.advertiser_id} className="border-t border-gray-100">
                        <td className="py-1 pr-2 font-mono text-[10px] text-gray-600">{a.advertiser_id === 'platform_own' ? '★ Own ads' : a.advertiser_id}</td>
                        <td className="py-1 px-2 tabular-nums">{num(a.posts)}</td>
                        <td className="py-1 px-2 tabular-nums">{num(a.reach)}</td>
                        <td className="py-1 px-2 tabular-nums">{num(a.impressions)}</td>
                        <td className="py-1 px-2 tabular-nums">{money(a.revenue_usd)}</td>
                        <td className="py-1 px-2 tabular-nums">{a.ecpm_usd == null ? '—' : money(a.ecpm_usd)}</td>
                        <td className="py-1 px-2 tabular-nums font-semibold">{money(a.delivered_value_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-3">{M.basis}</p>
        </>
      )}
    </div>
  );
}
