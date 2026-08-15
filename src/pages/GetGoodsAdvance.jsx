import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

// GetGoodsAdvance — optional, 0%, NON-RECOURSE, closed-loop store advance (opt-in).
// Voluntary: you can always buy with the balance you've already earned instead. If you don't earn
// it back, you owe nothing in cash. No lockout, no card charge on default, no collections.
// The whole feature is DISABLED until a licensed provider + counsel sign-off are configured, so this
// page will show "not available yet" until then.
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function GetGoodsAdvance() {
  const [elig, setElig] = useState(null);
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [e, t] = await Promise.all([
          base44.functions.invoke('goodsAdvanceEligibility', {}),
          base44.functions.invoke('goodsAdvanceTracker', {}),
        ]);
        setElig(e?.eligibility ?? null);
        setTracker(t?.active ?? null);
      } catch (err) {
        setMsg({ type: 'error', text: err?.message || 'Could not load advance status.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    setSubmitting(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('goodsAdvanceAccept', {
        amount_usd: Number(amount),
        disclosures_acknowledged: true,
      });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else setMsg({ type: 'ok', text: res?.note || 'Approved.' });
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
        <h1 className="text-2xl font-bold text-[#0a142e]">Goods Advance</h1>
        <Badge className="bg-[#e8c766] text-[#0a142e]">Optional · 0%</Badge>
      </div>

      {/* Active advance tracker (non-recourse, informational) */}
      {tracker && (
        <Card><CardContent className="p-5">
          <h3 className="font-bold text-gray-900 mb-2">Your advance</h3>
          <p className="text-sm text-gray-600">Remaining: <strong>{money(tracker.remaining)}</strong> of {money(tracker.principal)}</p>
          <p className="text-sm text-gray-600 mt-1">{tracker.message}</p>
          <p className="text-xs text-gray-400 mt-3">Repaid automatically from your earnings. You owe nothing in cash — if you don't earn it back, there's no charge and no collections.</p>
        </CardContent></Card>
      )}

      {/* Retired / superseded (default state — the program is no longer offered) */}
      {!live && (
        <Card><CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">This program has been replaced</p>
              <p className="text-sm text-gray-600 mt-1">The Goods Advance is no longer offered. Instead, everyone can use <a href="/SaveToGet" className="text-[#16264f] font-semibold underline">Save-to-Get</a> to set aside your own earnings toward an item — no advance, no balance owed — and premium members can claim the <a href="/PremiumBoost" className="text-[#16264f] font-semibold underline">advertiser-funded gift boost</a>. You can also always shop with the balance you've already earned.</p>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Live + not yet eligible */}
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

      {/* Live + eligible → opt-in with disclosures */}
      {live && elig && elig.available && !tracker && (
        <Card><CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-600">You may borrow up to</p>
            <p className="text-3xl font-extrabold text-[#0a142e]">{money(elig.maxOfferUsd)}</p>
            <p className="text-xs text-gray-500">to spend in the store · 0% APR · repay from your earnings over up to {elig.termMonths} months</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Please read</p>
            <ul className="space-y-1.5">
              {(elig.disclosures || []).map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>
              ))}
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            I've read and accept the terms above.
          </label>

          <div className="flex items-center gap-3">
            <input
              type="number" min="1" max={elig.maxOfferUsd} placeholder="Amount"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <Button
              disabled={!accepted || !amount || submitting || Number(amount) <= 0 || Number(amount) > elig.maxOfferUsd}
              onClick={submit}
              className="bg-[#16264f] hover:bg-[#0a142e]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get advance'}
            </Button>
          </div>
          <p className="text-xs text-gray-400">Using this is your choice. You can decline with no effect on your account, and buy with your earned balance instead.</p>
        </CardContent></Card>
      )}

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>
      )}
    </div>
  );
}
