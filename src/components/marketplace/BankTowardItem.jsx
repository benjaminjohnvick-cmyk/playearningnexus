import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PiggyBank, Loader2, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatCash } from '@/lib/siteCash';

/**
 * BankTowardItem — the "own this item with survey time" panel. Shows how much of the item the user
 * already owns with their earned Site Cash, a live progress bar, and how many minutes of surveys it takes
 * to own 1%…100%. "Bank toward this" saves it as a goal; the app notifies them the moment they're covered.
 *
 * Site Cash is closed-loop and non-withdrawable — ownership only ever becomes a discount or a fully-covered
 * item, never a cash payout. Props: listing (id, price_usd, title, image_url).
 */
export default function BankTowardItem({ listing }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banking, setBanking] = useState(false);
  const [banked, setBanked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('itemOwnershipPlan', listing?.id ? { listing_id: listing.id } : { price_usd: listing?.price_usd, title: listing?.title });
        if (alive && !res.data?.error) setPlan(res.data);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [listing?.id, listing?.price_usd]);

  const bank = async () => {
    setBanking(true);
    try {
      const res = await base44.functions.invoke('bankTowardItem', {
        listing_id: listing?.id || null, price_usd: listing?.price_usd, title: listing?.title, image_url: listing?.image_url,
      });
      if (res.data?.success) { setBanked(true); toast.success(res.data.message || 'Banking toward this item.'); }
      else toast.error(res.data?.error || 'Could not save this goal.');
    } catch { toast.error('Could not save this goal.'); }
    finally { setBanking(false); }
  };

  if (!listing || !(listing.price_usd > 0)) return null;
  if (loading) return <div className="p-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Working out your ownership…</div>;
  if (!plan) return null;

  const pct = Math.min(100, plan.current_ownership_pct || 0);
  const humanTime = (m) => (m == null ? '—' : m >= 90 ? `${Math.round(m / 60)} hr` : `${m} min`);

  return (
    <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBank className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-sm">Own it with survey time</h3>
        </div>

        {/* Ownership progress */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-600">You own <b className="text-indigo-700">{pct.toFixed(pct % 1 ? 1 : 0)}%</b></span>
          <span className="text-slate-500">{formatCash(plan.site_cash_usd)} of {formatCash(plan.price_usd)}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-3">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>

        {plan.covered_fully ? (
          <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold mb-3">
            <CheckCircle2 className="w-4 h-4" /> You've covered it — redeem any time, it ships fully covered.
          </div>
        ) : (
          <p className="text-xs text-slate-500 mb-3">
            <TrendingUp className="w-3 h-3 inline mr-1" />
            {humanTime(plan.ownership_table?.find((r) => r.pct === 100)?.minutes)} of surveys to own it outright ·
            {' '}{formatCash(plan.usd_to_full)} to go
          </p>
        )}

        {/* Minutes-to-own milestones */}
        <div className="grid grid-cols-4 gap-1 text-center mb-3">
          {(plan.ownership_table || []).filter((r) => [10, 25, 50, 100].includes(r.pct)).map((r) => (
            <div key={r.pct} className="rounded-md bg-white border border-slate-100 py-1.5">
              <div className="text-[11px] font-bold text-indigo-700">{r.pct}%</div>
              <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5"><Clock className="w-2.5 h-2.5" />{humanTime(r.minutes)}</div>
            </div>
          ))}
        </div>

        <Button size="sm" className="w-full" disabled={banking || banked} onClick={bank}>
          {banking ? <Loader2 className="w-4 h-4 animate-spin" /> : banked ? 'Banking toward this ✓' : 'Bank toward this item'}
        </Button>
        <p className="text-[10px] text-slate-400 mt-2 text-center">{plan.note}</p>
      </CardContent>
    </Card>
  );
}
