import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

// AdvertiserPerformanceCard — the AI performance report surfaced for the advertiser: the conventional PPC metric
// set measured from real activity (CTR/CPC/CPA/ROAS) each benchmarked against standard PPC norms, PLUS the full
// network-standard metric set (eCPM, CPM, CPP, IPM, windowed D1–D365 ROAS) and the new-vs-existing audience
// breakdown from adMetricsReport, plus the latest AI summary + recommendations. Reads the read-only
// advertiserPerformance + adMetricsReport endpoints. It measures and benchmarks actual performance; it NEVER
// guarantees an ROI, and below the data threshold it says "still gathering data".
const VERDICT = {
  above: { color: 'text-emerald-400', Icon: TrendingUp, label: 'above benchmark' },
  below: { color: 'text-red-400', Icon: TrendingDown, label: 'below benchmark' },
  at: { color: 'text-gray-300', Icon: Minus, label: 'at benchmark' },
  'n/a': { color: 'text-gray-500', Icon: Minus, label: 'gathering data' },
};
const unitFmt = (v, unit) => (unit === '$' ? `$${Number(v).toLocaleString()}` : unit === 'x' ? `${v}×` : `${v}${unit}`);

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function AdvertiserPerformanceCard() {
  const [data, setData] = useState(null);
  const [net, setNet] = useState(null); // full network metric set from adMetricsReport
  const [loading, setLoading] = useState(true);
  const [revAmount, setRevAmount] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revMsg, setRevMsg] = useState(null);
  const [showRev, setShowRev] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('advertiserPerformance', {});
      setData(res || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    // Full network metric set (eCPM/CPM/CPP/IPM, windowed ROAS, audience breakdown). Best-effort — the
    // report still renders the conventional set if this is disabled or errors.
    try {
      const nres = await base44.functions.invoke('adMetricsReport', { scope: 'advertiser' });
      setNet(nres && nres.enabled !== false ? nres : null);
    } catch {
      setNet(null);
    }
  };

  useEffect(() => { load(); }, []);

  const submitRevenue = async () => {
    const amt = Number(revAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setRevMsg({ type: 'error', text: 'Enter a positive amount.' }); return; }
    setRevBusy(true); setRevMsg(null);
    try {
      const res = await base44.functions.invoke('advertiserReportRevenue', { amount_usd: amt });
      if (res?.error) setRevMsg({ type: 'error', text: res.error });
      else { setRevMsg({ type: 'ok', text: 'Added — it will show in your metrics, flagged as reported.' }); setRevAmount(''); load(); }
    } catch (e) {
      setRevMsg({ type: 'error', text: e?.message || 'Could not save.' });
    } finally {
      setRevBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading performance report…
      </div>
    );
  }
  if (!data || data.enabled === false || !data.metrics) return null;

  const m = data.metrics;
  const rep = data.latest_report;
  const substantiated = m.substantiated;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <h3 className="font-black text-white text-sm">Performance report</h3>
        <span className="text-[11px] text-gray-500">last {m.window_days || 7}d</span>
      </div>

      {!substantiated ? (
        <p className="text-xs text-gray-400 mt-2">{m.basis}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {(data.comparison || []).map((c) => {
              const meta = VERDICT[c.verdict] || VERDICT['n/a'];
              const Icon = meta.Icon;
              return (
                <div key={c.metric} className="bg-black/30 rounded-xl p-3 border border-gray-800">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">{c.metric}</div>
                  <div className="text-white font-black text-base">{unitFmt(c.value, c.unit)}</div>
                  <div className={`text-[11px] flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" /> vs {unitFmt(c.benchmark, c.unit)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full network metric set (eCPM, CPM, CPP, IPM, windowed ROAS) from adMetricsReport. */}
          {net && net.metrics && (
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Network metrics</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { k: 'eCPM', v: money(net.metrics.ecpm_usd) },
                  { k: 'CPM', v: money(net.metrics.cpm_usd) },
                  { k: 'CPP', v: money(net.metrics.cpp_usd) },
                  { k: 'IPM', v: Number(net.metrics.ipm || 0).toLocaleString() },
                  { k: 'D7 ROAS', v: `${net.metrics.ad_roas_d7 || 0}×` },
                  { k: 'D28 ROAS', v: `${net.metrics.ad_roas_d28 || 0}×` },
                ].map((t) => (
                  <div key={t.k} className="bg-black/30 rounded-xl p-3 border border-gray-800">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">{t.k}</div>
                    <div className="text-white font-black text-base">{t.v}</div>
                  </div>
                ))}
              </div>

              {Array.isArray(net.metrics.windowed) && net.metrics.windowed.length > 0 && (
                <div className="mt-2 bg-black/30 rounded-xl p-3 border border-gray-800">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">ROAS by window (realized, trailing)</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {net.metrics.windowed.map((w) => (
                      <div key={w.window_days} className="text-xs">
                        <span className="text-gray-500">D{w.window_days}</span>{' '}
                        <span className="text-white font-bold">{w.ad_roas || 0}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {net.audience_breakdown && net.audience_breakdown.sampled > 0 && (
                <div className="mt-2 bg-black/30 rounded-xl p-3 border border-gray-800">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Audience — new vs existing (measured purchases)</div>
                  <div className="flex items-center gap-4 text-xs">
                    <div><span className="text-emerald-400 font-bold">{net.audience_breakdown.new.conversions}</span> <span className="text-gray-500">new</span></div>
                    <div><span className="text-blue-400 font-bold">{net.audience_breakdown.existing.conversions}</span> <span className="text-gray-500">existing</span></div>
                    <div className="text-gray-400">{net.audience_breakdown.new_share_pct}% new</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {rep && (rep.summary || (rep.recommendations && rep.recommendations.length > 0)) && (
            <div className="mt-4 bg-black/30 rounded-xl p-3 border border-gray-800">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">AI recommendations</span>
              </div>
              {rep.summary && <p className="text-xs text-gray-300 mb-2">{rep.summary}</p>}
              <ul className="space-y-1">
                {(rep.recommendations || []).map((r, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                    <span className="text-yellow-400 font-bold">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Report off-platform revenue — the write path so ROAS/ROI can include the advertiser's own attested,
          flagged off-platform sales. */}
      <div className="mt-4 pt-3 border-t border-gray-800">
        {!showRev ? (
          <button onClick={() => setShowRev(true)} className="text-[11px] text-blue-400 hover:text-blue-300">
            + Report off-platform revenue
          </button>
        ) : (
          <div className="space-y-2">
            <label htmlFor="offplatform-revenue" className="text-[11px] text-gray-400 block">
              Report off-platform revenue you attribute to these ads (counted in your metrics, flagged as reported)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="offplatform-revenue"
                type="number" min="0" value={revAmount} onChange={(e) => setRevAmount(e.target.value)}
                placeholder="Amount (USD)"
                className="w-36 bg-black/40 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <button
                onClick={submitRevenue} disabled={revBusy}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg px-3 py-1.5">
                {revBusy ? '…' : 'Add'}
              </button>
              <button onClick={() => { setShowRev(false); setRevMsg(null); }} className="text-[11px] text-gray-500">Cancel</button>
            </div>
            {revMsg && (
              <p className={`text-[11px] ${revMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{revMsg.text}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 mt-3">{data.disclaimer}</p>
    </div>
  );
}
