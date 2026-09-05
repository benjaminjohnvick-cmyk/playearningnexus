import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, TrendingUp, Users, DollarSign, Award, Layers } from 'lucide-react';

// FeaturePMF (admin) — the retention-weighted product-market-fit scoreboard for advertiser features, plus the
// per-tier "which features earn the most" revenue view. Reads featurePmfScoreboard + advertiserFeatureCatalog.
// Read-only analytics: it ranks by PMF score (retention-weighted), showing adoption, engagement, revenue, and
// the retention lift behind each rank. Runs continuously so PMF discovery continues after launch.

const usd = (v) => (v == null ? '—' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const pct = (v) => (v == null ? '—' : `${(Number(v) * 100).toFixed(0)}%`);
const scoreCls = (s) => (s >= 66 ? 'bg-emerald-100 text-emerald-700' : s >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700');

export default function FeaturePMF() {
  const [board, setBoard] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(3);

  const load = useCallback(async (live) => {
    setLoading(true); setErr('');
    try {
      const [b, c] = await Promise.all([
        base44.functions.invoke('featurePmfScoreboard', live ? { live: true } : {}),
        base44.functions.invoke('advertiserFeatureCatalog', {}),
      ]);
      if (b?.data?.error) setErr(b.data.error); else setBoard(b.data);
      if (!c?.data?.error) setCatalog(c.data);
    } catch (e) { setErr(e?.message || 'Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(false); }, [load]);

  const features = (board?.features || []);
  const byTier = (board?.by_tier || []).find((t) => t.tier === tier) || null;
  const catTier = (catalog?.tiers || []).find((t) => t.tier === tier) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Award className="w-6 h-6 text-indigo-600" /> Feature PMF Scoreboard</h1>
            <p className="text-slate-500 text-sm mt-1">Advertiser features ranked by product-market fit — retention-weighted. Window: {board?.window_days ?? '—'} days · source: {board?.source ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recompute live
            </button>
          </div>
        </div>

        {err && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{err}</div>}

        {/* Tier switch */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          {[1, 2, 3].map((t) => (
            <button key={t} onClick={() => setTier(t)} className={`px-3 py-1.5 rounded-lg text-sm ${tier === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Tier {t}</button>
          ))}
          {catTier && (
            <span className="text-xs text-slate-500 ml-2">
              {catTier.live_count} live · {catTier.pending_count} pending · +{usd(catTier.added_delivered_value_usd)} delivered value added (price held → ratio climbs)
            </span>
          )}
        </div>

        {/* Overall ranked scoreboard */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-600" /> Ranked by PMF score (retention-weighted)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2">#</th><th className="px-4 py-2">Feature</th><th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">PMF</th><th className="px-4 py-2">Retention lift</th>
                  <th className="px-4 py-2"><Users className="w-3.5 h-3.5 inline" /> Adopters</th>
                  <th className="px-4 py-2">Uses</th><th className="px-4 py-2"><DollarSign className="w-3.5 h-3.5 inline" /> Revenue</th>
                  <th className="px-4 py-2">Live</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.key} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-400">{f.rank}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                    <td className="px-4 py-2 text-slate-500">T{f.tier}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scoreCls(f.pmf_score)}`}>{f.pmf_score}</span></td>
                    <td className="px-4 py-2 text-slate-600">{f.retention_lift > 0 ? '+' : ''}{pct(f.retention_lift)}</td>
                    <td className="px-4 py-2 text-slate-600">{f.adopters?.toLocaleString?.() ?? f.adopters}</td>
                    <td className="px-4 py-2 text-slate-600">{f.uses?.toLocaleString?.() ?? f.uses}</td>
                    <td className="px-4 py-2 text-slate-600">{usd(f.revenue_usd)}</td>
                    <td className="px-4 py-2">{f.live ? <span className="text-emerald-600">●</span> : <span className="text-amber-500" title="activates when its prerequisite lands">○</span>}</td>
                  </tr>
                ))}
                {!features.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">No usage data yet — the scoreboard fills in as features are used.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-tier revenue ranking */}
        {byTier && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Highest-revenue features — Tier {tier} <span className="text-xs font-normal text-slate-400 ml-2">(tier total {usd(byTier.tier_revenue_usd)} in window)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(byTier.top_by_revenue || []).map((r, i) => (
                <div key={r.key} className="px-4 py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-700"><span className="text-slate-400 mr-2">{i + 1}.</span>{r.name}</span>
                  <span className="font-semibold text-slate-800">{usd(r.revenue_usd)}</span>
                </div>
              ))}
              {!(byTier.top_by_revenue || []).length && <div className="px-4 py-6 text-center text-slate-400 text-sm">No revenue recorded in this window yet.</div>}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400">Values are advertising value delivered and measured activity — never a revenue or ROI promise. The founding panel is measured as a privilege, not a quota.</p>
      </div>
    </div>
  );
}
