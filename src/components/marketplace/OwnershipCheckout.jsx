import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, PiggyBank, CreditCard } from 'lucide-react';

/**
 * OwnershipCheckout — the percentage-first checkout. The buyer chooses how much to pay out of pocket; the
 * app shows the rest as an OWNERSHIP-% DISCOUNT they earn back via surveys, with the survey minutes to earn
 * it. Numbers are shown as percentages + minutes, not dollars. Earned ownership is a discount on THIS
 * purchase (closed-loop) — banked toward this item, never sold to anyone else.
 *
 * Props: listing (id, price_usd, title), onPay(outOfPocketUsd), onBank().
 */
export default function OwnershipCheckout({ listing, onPay, onBank }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oopPct, setOopPct] = useState(null);   // slider value (% paid out of pocket)

  const price = Number(listing?.price_usd) || 0;

  const fetchQuote = useCallback(async (pct) => {
    if (!(price > 0)) return;
    try {
      const oopUsd = pct != null ? price * (pct / 100) : undefined;
      const res = await base44.functions.invoke('checkoutOwnershipQuote', { listing_id: listing?.id, price_usd: price, out_of_pocket_usd: oopUsd });
      if (!res.data?.error) { setQuote(res.data); if (oopPct == null) setOopPct(res.data.out_of_pocket_pct); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [price, listing?.id, oopPct]);

  useEffect(() => { fetchQuote(null); }, [fetchQuote]);

  const onSlide = (v) => {
    setOopPct(v);
    fetchQuote(v);
  };

  if (!(price > 0)) return null;
  if (loading || !quote) return <div className="p-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Working out your options…</div>;

  const minOop = 100 - quote.max_discount_pct;
  const humanTime = (m) => (m == null ? '—' : m >= 90 ? `${Math.round(m / 60)} hr` : `${m} min`);

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-4">
        <h3 className="font-bold text-sm mb-1">How do you want to pay?</h3>
        <p className="text-xs text-slate-500 mb-3">Pay part now, earn the rest back as ownership by completing surveys.</p>

        {/* The split, shown as percentages */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-center rounded-lg bg-slate-50 py-2">
            <div className="text-2xl font-bold text-slate-800">{Math.round(quote.out_of_pocket_pct)}%</div>
            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1"><CreditCard className="w-3 h-3" /> you pay now</div>
          </div>
          <div className="flex-1 text-center rounded-lg bg-emerald-50 py-2">
            <div className="text-2xl font-bold text-emerald-700">{Math.round(quote.earn_back_pct)}%</div>
            <div className="text-[11px] text-emerald-600">ownership you earn back</div>
          </div>
        </div>

        {/* Slider: choose out-of-pocket % */}
        <div className="mb-3">
          <input type="range" min={minOop} max={100} step={1} value={Math.round(oopPct ?? quote.out_of_pocket_pct)}
            onChange={(e) => onSlide(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>earn back up to {quote.max_discount_pct}%</span>
            <span>pay 100%</span>
          </div>
        </div>

        <div className="text-xs text-slate-600 mb-3 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          Earn that {Math.round(quote.earn_back_pct)}% back with about <b className="mx-1">{humanTime(quote.minutes)}</b> of surveys.
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onPay && onPay(quote.out_of_pocket_usd)}>
            Pay {Math.round(quote.out_of_pocket_pct)}% now & earn the rest
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBank && onBank()}>
            <PiggyBank className="w-4 h-4 mr-1" /> Bank ownership
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">{quote.note}</p>
      </CardContent>
    </Card>
  );
}
