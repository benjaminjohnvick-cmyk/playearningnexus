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
const ACTION_CLS = {
  promote: 'bg-emerald-100 text-emerald-700',
  hold: 'bg-slate-100 text-slate-600',
  watch: 'bg-sky-100 text-sky-700',
  fix: 'bg-amber-100 text-amber-700',
  sunset: 'bg-rose-100 text-rose-700',
};

export default function FeaturePMF() {
  const [board, setBoard] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(3);

  const load = useCallback(async (live) => {
    setLoading(true); setErr('');
    try {
      const [b, c, cov] = await Promise.all([
        base44.functions.invoke('featurePmfScoreboard', live ? { live: true } : {}),
        base44.functions.invoke('advertiserFeatureCatalog', {}),
        base44.functions.invoke('revenueStreamCoverage', {}),
      ]);
      if (b?.data?.error) setErr(b.data.error); else setBoard(b.data);
      if (!c?.data?.error) setCatalog(c.data);
      if (!cov?.data?.error) setCoverage(cov.data);
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

        {/* AI PMF & revenue agent plan */}
        {board?.agent_plan?.plan && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2"><Award className="w-4 h-4 text-violet-600" /> AI PMF & revenue agent — action plan</span>
              <span className="text-xs font-normal text-slate-400">{board.agent_plan.summary?.pending_approvals || 0} awaiting your approval · updated {board.agent_plan.computed_at ? new Date(board.agent_plan.computed_at).toLocaleString() : '—'}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {board.agent_plan.plan.map((p) => (
                <div key={p.key} className="px-4 py-2.5 flex items-start justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{p.name}</span>
                      <span className="text-xs text-slate-400">T{p.tier}</span>
                      {p.sensitive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">needs approval</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.rationale}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_CLS[p.action] || 'bg-slate-100 text-slate-600'}`}>{p.action}{p.pricing_hint && p.pricing_hint !== 'none' ? ` · price ${p.pricing_hint}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete revenue-stream coverage — all 45 sub-points */}
        {coverage?.by_category && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-teal-600" /> All revenue streams — coverage ({coverage.stream_count} across 8 categories)</span>
              <span className="text-xs font-normal text-slate-400">{coverage.live_count} live · {coverage.tiered_count} tiered · {usd(coverage.total_revenue_usd)} total ({coverage.window_days}d)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {coverage.by_category.map((cat) => (
                <div key={cat.category} className="px-4 py-2.5">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>{cat.category}. {cat.name} <span className="text-xs font-normal text-slate-400">({cat.live_count}/{cat.count} live)</span></span>
                    <span className="text-slate-800">{usd(cat.category_revenue_usd)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {cat.streams.map((s) => (
                      <span key={s.key} title={`${s.status}${s.tiered ? ' · tiered' : ''} · ${usd(s.revenue_usd)}`}
                        className={`text-[11px] px-1.5 py-0.5 rounded ${s.live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'} ${s.tiered ? 'ring-1 ring-indigo-300' : ''}`}>
                        {s.name}{s.tiered ? ' ◆' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">◆ = advertiser tier feature (also PMF-ranked above) · green = live · grey = gated/counsel (activates when its prerequisite lands). Every stream is tracked for revenue; the PMF ranking covers the advertiser subset where retention is meaningful.</div>
          </div>
        )}

        <p className="text-xs text-slate-400">Values are advertising value delivered and measured activity — never a revenue or ROI promise. The founding panel is measured as a privilege, not a quota. The AI agent collects signals, ranks fit + revenue, and learns continuously; pricing / tier / money moves are surfaced for your approval — nothing sensitive is auto-applied.</p>
      </div>
    </div>
  );
}
