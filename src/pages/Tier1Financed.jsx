import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

// Tier1Financed — OPTIONAL "pay-from-earnings" financing for the $12,000 Tier 1 package.
// RECOURSE: the $12,000 is OWED. The site sweeps in-app earnings toward it over the year; any remaining
// balance is DUE at term end. DISABLED until a licensed creditor + counsel sign-off are configured, so this
// page shows "not available yet" by default. No lockout, no card charge, no in-app collections.
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function Tier1Financed() {
  const [elig, setElig] = useState(null);
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [sweepOk, setSweepOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [e, t] = await Promise.all([
          base44.functions.invoke('tier1FinancedEligibility', {}),
          base44.functions.invoke('tier1FinancedTracker', {}),
        ]);
        setElig(e?.eligibility ?? null);
        setTracker(t?.active ?? null);
      } catch (err) {
        setMsg({ type: 'error', text: err?.message || 'Could not load financing status.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    setSubmitting(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('tier1FinancedAccept', {
        disclosures_acknowledged: true,
        sweep_authorized: true,
      });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else setMsg({ type: 'ok', text: res?.note || 'Recorded.' });
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Something went wrong.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const live = elig?.programLive;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[#16264f]" />
        <h1 className="text-2xl font-bold text-[#0a142e]">Tier 1 — Pay From Earnings</h1>
        <Badge className="bg-[#e8c766] text-[#0a142e]">Financed · owed</Badge>
      </div>

      {/* Active plan tracker */}
      {tracker && (
        <Card><CardContent className="p-5">
          <h3 className="font-bold text-gray-900 mb-2">Your financed Tier 1</h3>
          <p className="text-sm text-gray-600">Remaining: <strong>{money(tracker.remaining_usd)}</strong> of {money(tracker.principal_usd)}</p>
          <p className="text-sm text-gray-600 mt-1">{tracker.message}</p>
          {tracker.recourse && tracker.projectedShortfallUsd > 0 && (
            <p className="text-xs text-red-600 mt-3">Projected balance still owed at term end: about {money(tracker.projectedShortfallUsd)}. This is recourse — a shortfall is payable in cash.</p>
          )}
        </CardContent></Card>
      )}

      {/* Not available yet (default) */}
      {!live && (
        <Card><CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Not available yet</p>
              <p className="text-sm text-gray-600 mt-1">Tier 1 financing is being finalized with a licensed creditor and legal review. For now you can pay the package upfront, or use the free non-recourse earn-to-unlock tier where nothing is ever owed.</p>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Live but not eligible */}
      {live && elig && !elig.available && (
        <Card><CardContent className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Not eligible yet</p>
              <p className="text-sm text-gray-600 mt-1">{elig.reason}</p>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Live + eligible → opt-in with honest recourse disclosures */}
      {live && elig && elig.available && !tracker && (
        <Card><CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-600">Finance the Tier 1 package — you will owe</p>
            <p className="text-3xl font-extrabold text-[#0a142e]">{money(elig.principalUsd)}</p>
            <p className="text-xs text-gray-500">{elig.aprPct === 0 ? '0% APR' : `${elig.aprPct}% APR`} · {Math.round((elig.sweepPct || 1) * 100)}% of your earnings applied over {elig.termMonths} months · remainder due at term end</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-semibold">This is a debt, not a fee waiver.</p>
            <p className="text-xs text-red-700 mt-1">If your earnings don't cover the {money(elig.principalUsd)} by the end of the term, you still owe the difference in cash. At your recent earn rate, roughly {money(elig.projectedShortfallUsd)} could remain owed.</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Please read</p>
            <ul className="space-y-1.5">
              {(elig.disclosures || []).map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>
              ))}
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            I understand I owe {money(elig.principalUsd)} and that any balance not covered by earnings is due at term end.
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={sweepOk} onChange={(e) => setSweepOk(e.target.checked)} className="mt-0.5" />
            I authorize the site to apply {Math.round((elig.sweepPct || 1) * 100)}% of my in-app earnings to this balance.
          </label>

          <Button
            disabled={!accepted || !sweepOk || submitting}
            onClick={submit}
            className="bg-[#16264f] hover:bg-[#0a142e]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finance Tier 1'}
          </Button>
          <p className="text-xs text-gray-400">Using this is your choice. You can pay upfront instead, or use the free non-recourse earn-to-unlock tier where nothing is ever owed.</p>
        </CardContent></Card>
      )}

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>
      )}
    </div>
  );
}
