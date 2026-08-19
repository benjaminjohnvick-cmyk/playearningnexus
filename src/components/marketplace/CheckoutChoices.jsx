import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Wallet, PiggyBank, Clock, Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatCash } from '@/lib/siteCash';
import BankTowardItem from './BankTowardItem';
import EarnBackPlanPanel from './EarnBackPlanPanel';

/**
 * CheckoutChoices — the "how do you want to get this?" screen shown before purchase. Presents the ways a
 * user can pay, all inside the closed loop (no cash ever leaves the platform, no lending, no default):
 *
 *   1. Pay by card — own it outright now.
 *   2. Apply the Site Cash you can afford now → cash discount (spend-cap limited).
 *   3. Apply your MAX allowed Site Cash → biggest discount, card covers the rest.
 *   4. Bank your survey time until you own 100% → ships fully covered.
 *   5. Reserve & keep earning (no debt, nothing to default on) — same mechanism as #4.
 *   6. Pay by card now AND earn Site Cash back on it via surveys.
 *   7. Willing to wait for better sourcing? choose a wait window.
 *
 * Props: listing (id, price_usd, title, image_url), onDone().
 */
export default function CheckoutChoices({ listing, onDone }) {
  const [choice, setChoice] = useState(null);
  const [plan, setPlan] = useState(null);
  const [autoQuote, setAutoQuote] = useState(null); // Site Cash that auto-applies (honors the buyer's setting)
  const [busy, setBusy] = useState(false);
  const [waitDays, setWaitDays] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('itemOwnershipPlan', listing?.id ? { listing_id: listing.id } : { price_usd: listing?.price_usd });
        if (alive && !res.data?.error) setPlan(res.data);
      } catch { /* ignore */ }
      try {
        const q = await base44.functions.invoke('checkoutSiteCashQuote', { price_usd: listing?.price_usd });
        const d = q?.data ?? q;
        if (alive && d?.apply && d.points_usd > 0) setAutoQuote(d);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [listing?.id, listing?.price_usd]);

  if (!listing || !(listing.price_usd > 0)) return null;

  // applyPoints: true = force apply, false = force off, undefined = let the server decide from the buyer's
  // auto-apply setting (so "pay by card" still gets their Site Cash discount when they've left it on).
  const card = async (applyPoints, waitPref) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('hybridCheckout', {
        listing_id: listing.id,
        ...(applyPoints === undefined ? {} : { apply_points: !!applyPoints }),
        ...(waitPref ? { wait_days: waitPref } : {}),
      });
      if (res.data?.blocked) toast.error(res.data.message || 'Payment method unavailable');
      else if (res.data?.success) {
        if (res.data.approve_url) { toast.success('Redirecting to PayPal…'); window.location.href = res.data.approve_url; return; }
        toast.success(res.data.message || 'Order placed — fills within 24 hours.');
        if (onDone) onDone();
      } else toast.error(res.data?.error || res.data?.message || 'Checkout failed');
    } catch (e) { toast.error(e?.data?.error || e.message || 'Checkout failed'); }
    finally { setBusy(false); }
  };

  const discountNow = plan?.discount_now_usd || 0;
  const priceUsd = plan?.price_usd ?? listing.price_usd;
  const autoUsd = autoQuote ? Number(autoQuote.points_usd) : 0;         // Site Cash that auto-applies
  const autoCardUsd = autoQuote ? Number(autoQuote.card_after_usd) : priceUsd; // card charge after it

  const options = [
    { key: 'card', icon: CreditCard, title: 'Pay by card — own it outright',
      desc: autoUsd > 0
        ? `${formatCash(autoUsd)} Site Cash applied — pay ${formatCash(autoCardUsd)} by card, it's yours.`
        : `Pay ${formatCash(priceUsd)} now, it's yours.` },
    { key: 'apply', icon: Wallet, title: 'Apply my Site Cash for a discount', desc: discountNow > 0 ? `Take ${formatCash(discountNow)} off now — card covers the rest.` : 'Use earned Site Cash to cut the price.' },
    { key: 'bank', icon: PiggyBank, title: 'Bank survey time until I own 100%', desc: 'Save up — it ships fully covered, no card needed.' },
    { key: 'earnback', icon: Sparkles, title: 'Pay by card now, earn Site Cash back', desc: 'Buy it today and earn it back through surveys.' },
    { key: 'wait', icon: Clock, title: 'Willing to wait for the best price?', desc: 'Give us a window to source it cheaper.' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">How do you want to get this?</div>
      {autoUsd > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
          <Wallet className="w-4 h-4 flex-shrink-0 text-green-600" />
          <span><strong>{formatCash(autoUsd)}</strong> of your Site Cash applies automatically at checkout — you pay <strong>{formatCash(autoCardUsd)}</strong> by card. Turn this off anytime in Settings.</span>
        </div>
      )}
      {options.map((o) => {
        const Active = choice === o.key;
        return (
          <Card key={o.key} className={`cursor-pointer transition ${Active ? 'border-indigo-500 ring-1 ring-indigo-300' : 'border-slate-200'}`} onClick={() => setChoice(o.key)}>
            <CardContent className="p-3 flex items-start gap-3">
              <o.icon className={`w-5 h-5 mt-0.5 ${Active ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{o.title}</div>
                <div className="text-xs text-slate-500">{o.desc}</div>

                {Active && o.key === 'card' && (
                  <Button size="sm" className="mt-2" disabled={busy} onClick={(e) => { e.stopPropagation(); card(undefined); }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (autoUsd > 0 ? `Pay ${formatCash(autoCardUsd)} by card` : `Pay ${formatCash(priceUsd)} by card`)}
                  </Button>
                )}
                {Active && o.key === 'apply' && (
                  <Button size="sm" className="mt-2" disabled={busy || discountNow <= 0} onClick={(e) => { e.stopPropagation(); card(true); }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : discountNow > 0 ? `Apply ${formatCash(discountNow)} + card ${formatCash(priceUsd - discountNow)}` : 'No Site Cash to apply yet'}
                  </Button>
                )}
                {Active && o.key === 'bank' && (
                  <div className="mt-2"><BankTowardItem listing={listing} /></div>
                )}
                {Active && o.key === 'earnback' && (
                  <div className="mt-2" role="button" tabIndex={0} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><EarnBackPlanPanel listing={listing} /></div>
                )}
                {Active && o.key === 'wait' && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {[3, 7, 14, 30].map((d) => (
                      <button key={d} onClick={(e) => { e.stopPropagation(); setWaitDays(d); }}
                        className={`text-xs px-2 py-1 rounded border ${waitDays === d ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-600'}`}>
                        {d} days
                      </button>
                    ))}
                    <Button size="sm" disabled={busy || !waitDays} onClick={(e) => { e.stopPropagation(); card(false, waitDays); }}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Set</>}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <p className="text-[11px] text-slate-400 text-center">Orders fill in batches within 24 hours. Site Cash spends only here and is never withdrawable.</p>
    </div>
  );
}
