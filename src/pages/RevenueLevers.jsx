import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, AlertCircle, CheckCircle2, Lock, Scale } from 'lucide-react';

// RevenueLevers (admin) — governance view of every monetization sub-point across all 8 categories: which are
// BUILT (live & wired), GATED (safe-OFF, need a third-party account), or COUNSEL (not built, lawyer first).
// Reads revenueLeversStatus. Read-only — it never changes a gate; each lever obeys its own setting/KYC/counsel.

const BADGE = {
  built: { cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Built' },
  gated: { cls: 'bg-amber-100 text-amber-700', icon: Lock, label: 'Gated' },
  counsel: { cls: 'bg-rose-100 text-rose-700', icon: Scale, label: 'Counsel' },
};
const usd = (v) => (v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default function RevenueLevers() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await base44.functions.invoke('revenueLeversStatus', {});
      if (res?.data?.error) setErr(res.data.error);
      else setData(res.data);
    } catch (e) { setErr(e?.message || 'Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals || {};
  const cats = data?.categories || {};
  const earned = data?.earned_by_ledger_type || {};
  const configuredOn = data?.configured_on || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Revenue Levers</h1>
            <p className="text-xs text-gray-500">Every monetization sub-point across all 8 categories, and its state. Read-only — each lever still obeys its own gate.</p>
          </div>
          <button onClick={load} className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm hover:bg-gray-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {err && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {err}</div>}

        {data?.enabled === false && (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">The revenue-levers registry is turned off.</div>
        )}

        {totals.total ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">Built & wired</div><div className="text-2xl font-black text-emerald-600">{totals.built}</div></div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">Gated (needs a connect)</div><div className="text-2xl font-black text-amber-600">{totals.gated}</div></div>
            <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">Counsel-only</div><div className="text-2xl font-black text-rose-600">{totals.counsel}</div></div>
          </div>
        ) : null}

        {Object.keys(cats).sort((a, b) => Number(a) - Number(b)).map((cid) => {
          const c = cats[cid];
          if (!c) return null;
          return (
            <div key={cid} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-800">{cid}. {c.name}</h2>
                <div className="text-[11px] text-gray-400">{c.built} built · {c.gated} gated · {c.counsel} counsel</div>
              </div>
              <div className="space-y-2">
                {(c.levers || []).map((l) => {
                  const bd = BADGE[l.status] || BADGE.gated;
                  const Icon = bd.icon;
                  const earn = l.ledger_type ? earned[l.ledger_type] : null;
                  return (
                    <div key={l.key} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{l.name}</div>
                        <div className="text-[11px] text-gray-400">
                          {l.ledger_type && <>books: <span className="font-mono">{l.ledger_type}</span></>}
                          {l.setting_key && <> · gate: <span className="font-mono">{l.setting_key}</span></>}
                          {l.needs && <> · needs: {l.needs}</>}
                          {l.note && <> · {l.note}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.status === 'built' && earn != null && <span className="text-[11px] text-gray-500">{usd(earn)}</span>}
                        {l.enable_flag && configuredOn[l.key] && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" title="Switched on in the Setup Wizard — still awaiting its account/counsel to earn">On · awaiting</span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${bd.cls}`}>
                          <Icon className="w-3 h-3" /> {bd.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-gray-400">
          "Built" = code-complete and wired to the ledger (earns when its setting is on). "Gated" = platform-side code exists,
          safe-OFF, and needs an external account connected before it can earn. "Counsel" = deliberately not built pending an attorney.
          Enabling a lever elsewhere never bypasses its counsel gate.
        </p>
      </div>
    </div>
  );
}
