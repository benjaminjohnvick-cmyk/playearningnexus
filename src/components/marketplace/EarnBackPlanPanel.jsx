import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle2, PauseCircle, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * EarnBackPlanPanel — the Prepay & Earn-Back Discount UI. The member picks a discount PERCENTAGE (never a
 * dollar figure) and sees the survey MINUTES it takes to earn it back, with an honest day estimate. Once
 * started, it shows progress, grace days left, a paused state if they've missed too many days, and the
 * option to stop (unearned prepayment converts to non-expiring Site Cash — never forfeited, never withdrawn).
 *
 * The discount is a rebate on the member's OWN purchase, paid back as closed-loop Site Cash. "Ownership %"
 * is a progress label, not a tradeable stake. Props: listing { id, price_usd, title }.
 */
export default function EarnBackPlanPanel({ listing }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState(null);
  const [starting, setStarting] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState('');   // plan_id awaiting a second confirm click

  const fmtMin = (m) => {
    const x = Math.round(Number(m) || 0);
    if (x < 60) return `${x} min`;
    const h = Math.floor(x / 60); const r = x % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };
  const daysAt = (m, perDay = 30) => Math.max(1, Math.ceil((Number(m) || 0) / perDay));

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('earnBackStatus', {});
      if (!res.data?.error) {
        setStatus(res.data);
        const max = Number(res.data.max_discount_pct) || 50;
        setPct((p) => (p > 0 ? Math.min(p, max) : Math.min(25, max)));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Preview the minutes for the chosen % without committing — reuses the percentage-checkout quote.
  useEffect(() => {
    let alive = true;
    (async () => {
      const price = Number(listing?.price_usd) || 0;
      if (!price || !pct) { setPreview(null); return; }
      try {
        const oop = Math.round(price * (1 - pct / 100) * 100) / 100;
        const res = await base44.functions.invoke('checkoutOwnershipQuote', { listing_id: listing?.id, price_usd: price, out_of_pocket_usd: oop });
        if (alive && !res.data?.error) setPreview(res.data);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [pct, listing?.id, listing?.price_usd]);

  const start = async () => {
    if (!pct) return;
    setStarting(true);
    try {
      const payload = listing?.id ? { listing_id: listing.id, chosen_pct: pct } : { price_usd: listing?.price_usd, item_title: listing?.title, chosen_pct: pct };
      const res = await base44.functions.invoke('earnBackStart', payload);
      if (res.data?.error) toast.error(res.data.error);
      else { toast.success(`Plan started — earn ${pct}% back with about ${fmtMin(res.data.minutes_required)} of surveys.`); await loadStatus(); }
    } catch { toast.error('Could not start the plan.'); } finally { setStarting(false); }
  };

  const quit = async (planId) => {
    if (confirmQuit !== planId) { setConfirmQuit(planId); return; }
    setConfirmQuit('');
    try {
      const res = await base44.functions.invoke('earnBackAbandon', { plan_id: planId });
      if (res.data?.error) toast.error(res.data.error);
      else toast.success('Stopped. Your unearned prepayment is now Site Cash — non-expiring, spends on this site.');
      await loadStatus();
    } catch { toast.error('Could not stop the plan.'); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading your earn-back plans…</div>;
  if (!status?.enabled) return null;

  const max = Number(status.max_discount_pct) || 50;
  const chips = [10, 25, 50, 75, 100].filter((v) => v <= max);
  const active = (status.plans || []).filter((p) => p.status === 'active' || p.status === 'paused');
  const finished = (status.plans || []).filter((p) => p.status === 'completed' || p.status === 'abandoned');

  return (
    <Card className="border-violet-100">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Earn this discount back</div>
          {status.is_premium
            ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">Premium · fast</span>
            : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">Standard</span>}
        </div>

        {/* Start a new plan */}
        {listing?.price_usd ? (
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Pick how much of this item to earn back as a discount. You pay upfront and earn it back with surveys — it returns to you as Site Cash.</div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((v) => (
                <button key={v} onClick={() => setPct(v)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${pct === v ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'}`}>
                  {v}% off
                </button>
              ))}
            </div>
            {preview && pct > 0 && (
              <div className="text-xs rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 mt-0.5 text-violet-500 shrink-0" />
                <span>
                  About <strong>{fmtMin(preview.minutes)}</strong> of surveys to earn <strong>{pct}%</strong> back
                  <span className="text-slate-500"> — roughly {daysAt(preview.minutes)} days at 30 min/day.</span>
                </span>
              </div>
            )}
            <Button size="sm" disabled={!pct || starting} onClick={start} className="w-full">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Start earning ${pct || ''}% back`}
            </Button>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Do a survey each day to keep earning. You get {status.grace_days_per_month} skip-days a month; miss more and earning just pauses — you never lose what you&rsquo;ve earned.
            </div>
          </div>
        ) : null}

        {/* Active plans */}
        {active.length > 0 && (
          <div className="space-y-3 pt-1">
            {active.map((p) => (
              <div key={p.plan_id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.item_title || 'Item'}</div>
                  <div className="text-xs text-slate-500">{Math.round(p.ownership_pct)}% / {p.chosen_pct}%</div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${Math.min(100, (p.ownership_pct / (p.chosen_pct || 1)) * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{fmtMin(p.minutes_done)} done · {fmtMin(Math.max(0, p.minutes_required - p.minutes_done))} left</span>
                  <span>{p.grace_left}/{p.grace_total} skip-days left</span>
                </div>
                {p.paused && (
                  <div className="text-[11px] rounded bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 flex items-center gap-1">
                    <PauseCircle className="w-3.5 h-3.5" /> Paused — do a survey to start earning again. Your progress is safe.
                  </div>
                )}
                <div className="flex justify-end">
                  {confirmQuit === p.plan_id ? (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-500">Stop and convert unearned prepayment to Site Cash?</span>
                      <button onClick={() => quit(p.plan_id)} className="text-rose-600 font-medium">Yes, stop</button>
                      <button onClick={() => setConfirmQuit('')} className="text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => quit(p.plan_id)} className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-0.5">
                      <XCircle className="w-3 h-3" /> Stop plan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Finished / abandoned */}
        {finished.length > 0 && (
          <div className="space-y-1 pt-1">
            {finished.map((p) => (
              <div key={p.plan_id} className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate flex items-center gap-1">
                  {p.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3" />}
                  {p.item_title || 'Item'}
                </span>
                <span>{p.status === 'completed' ? `${p.chosen_pct}% earned` : 'stopped'}</span>
              </div>
            ))}
          </div>
        )}

        {status.is_premium && status.premium_headroom_usd != null && status.premium_headroom_usd <= 10 && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            You&rsquo;re near this month&rsquo;s premium earn-back limit — it resets at the start of next month.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
