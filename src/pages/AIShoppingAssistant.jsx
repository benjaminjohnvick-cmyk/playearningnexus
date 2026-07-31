import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Check, ExternalLink, Zap, ShoppingCart, Coins } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AIShoppingAssistant — the shopping copilot. The user describes what they want; the AI finds real products
 * across authorized feeds + the catalog and autofills an order. The user approves and completes their OWN
 * purchase through a sanctioned channel: dropship (full-auto, ships from our supplier), affiliate (finish on
 * the retailer's site), or the buying desk. No bot, no scraping.
 */
export default function AIShoppingAssistant() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);      // { sourced_order_id, items, recommendation_index, note }
  const [applyPoints, setApplyPoints] = useState(false);
  const [busyIdx, setBusyIdx] = useState(null);

  const search = async () => {
    if (q.trim().length < 2) { toast.error('Tell me what you want to buy.'); return; }
    setLoading(true); setDraft(null);
    try {
      const res = await base44.functions.invoke('aiOrderAssistant', { request: q });
      if (res.data?.error) toast.error(res.data.error);
      else setDraft(res.data);
    } catch { toast.error('The assistant is unavailable right now.'); }
    finally { setLoading(false); }
  };

  const checkout = async (idx) => {
    setBusyIdx(idx);
    try {
      const res = await base44.functions.invoke('assistedCheckout', { sourced_order_id: draft.sourced_order_id, item_index: idx, apply_points: applyPoints });
      const d = res.data || {};
      if (!d.success) { toast.error(d.error || d.message || 'Checkout failed'); return; }
      if (d.channel === 'affiliate' && d.buy_url) { toast.success('Opening the retailer to finish your purchase.'); window.open(d.buy_url, '_blank', 'noopener,noreferrer'); }
      else if (d.channel === 'dropship' && d.approve_url) { toast.success('Redirecting to PayPal to finish payment…'); window.location.href = d.approve_url; return; }
      else toast.success(d.message || 'Order placed.');
    } catch (e) { toast.error(e?.data?.error || 'Checkout failed'); }
    finally { setBusyIdx(null); }
  };

  const items = draft?.items || [];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-2 flex items-center gap-2"><Sparkles className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl md:text-3xl font-bold">AI Shopping Assistant</h1></div>
      <p className="text-sm text-slate-500 mb-4">Tell me what you want. I'll find it, price it, and set up the order — you approve and buy. We fulfill automatically where we can; otherwise you finish on the retailer.</p>

      <div className="flex gap-2 mb-6">
        <Input placeholder="e.g. wireless noise-cancelling headphones under $120" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <Button onClick={search} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find it'}</Button>
      </div>

      {draft && (
        <>
          {draft.note && <div className="mb-3 rounded-lg bg-indigo-50 text-indigo-800 text-sm p-3">{draft.note}</div>}
          {!draft.feeds_connected && <div className="mb-3 text-xs text-amber-600">Product feeds aren't connected yet — showing platform catalog matches. Connect a feed to search everywhere.</div>}

          <label className="flex items-center gap-2 text-sm text-slate-600 mb-3 cursor-pointer">
            <input type="checkbox" checked={applyPoints} onChange={(e) => setApplyPoints(e.target.checked)} className="w-4 h-4" />
            <Coins className="w-4 h-4 text-emerald-600" /> Apply my points to the order (on dropship items)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((it, idx) => (
              <Card key={idx} className={`overflow-hidden ${idx === draft.recommendation_index ? 'ring-2 ring-indigo-400' : ''}`}>
                <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  {it.image_url ? <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" /> : <span className="text-3xl">🛍️</span>}
                </div>
                <CardContent className="p-3">
                  {idx === draft.recommendation_index && <div className="text-[11px] font-semibold text-indigo-600 mb-1">★ AI pick</div>}
                  <div className="font-semibold text-sm truncate">{it.title}</div>
                  <div className="text-xs text-slate-500">{it.retailer || 'store'} · ${Number(it.price_usd).toFixed(2)}</div>
                  <div className="mt-1 text-[11px] flex items-center gap-1">
                    {it.fully_automated
                      ? <span className="text-emerald-600 flex items-center gap-1"><Zap className="w-3 h-3" /> We ship it automatically</span>
                      : it.channel === 'affiliate' ? <span className="text-slate-500 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Finish on retailer</span>
                      : <span className="text-slate-500">Our team places it</span>}
                  </div>
                  <Button size="sm" className="w-full mt-2" disabled={busyIdx === idx} onClick={() => checkout(idx)}>
                    {busyIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" />
                      : it.channel === 'affiliate' ? <><ExternalLink className="w-4 h-4 mr-1" /> Buy on retailer</>
                      : <><ShoppingCart className="w-4 h-4 mr-1" /> Approve &amp; buy</>}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {!items.length && <div className="text-slate-400 text-sm">No matches — try more detail.</div>}
        </>
      )}
    </div>
  );
}
