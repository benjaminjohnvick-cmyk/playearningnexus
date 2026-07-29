import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Truck, Store, CreditCard, Coins, Clock, Landmark, Loader2, Search, AlertTriangle, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/components/locale/LocaleContext';

// PhysicalStore — the "Buy Physical Items" section. Two ways to get an item: (1) buy online & have it
// shipped, or (2) buy locally & pick it up. Full marketplace parity: search, sort, localized pricing +
// country flag. Payment options per item: Credit card (DEFAULT, +markup) · Points/surveys-only · Affirm
// BNPL · Layaway (pay it down with earned points before it ships, ≤ the monthly cap). Promotional
// (welcome) credit auto-applies per the existing rules. Orders over the affordability threshold warn the
// buyer before they commit. The Purchase Payback tracker shows progress "earning back" cash spent.
export default function PhysicalStore() {
  const { formatPrice, country } = useLocale();
  const [mode, setMode] = useState('ship');          // 'ship' | 'pickup'
  const [cfg, setCfg] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [busy, setBusy] = useState('');
  const [warn, setWarn] = useState(null);            // { listing, method }
  const [layaways, setLayaways] = useState([]);
  const [payback, setPayback] = useState(null);

  const loadCfg = useCallback(() => {
    base44.functions.invoke('physicalStoreConfig', {}).then((r) => setCfg(r.data || null)).catch(() => {});
    base44.functions.invoke('layawayStatus', {}).then((r) => setLayaways(r.data?.layaways || [])).catch(() => {});
    base44.functions.invoke('purchasePaybackStatus', {}).then((r) => setPayback(r.data?.enabled ? r.data : null)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = country
        ? await base44.entities.MarketplaceListing.filter({ status: 'active', country }, '-created_at', 200).catch(() => [])
        : [];
      let data = base;
      if (!data.length) data = await base44.entities.MarketplaceListing.filter({ status: 'active' }, '-created_at', 200).catch(() => []);
      setListings(data || []);
    } finally { setLoading(false); }
  }, [country]);

  useEffect(() => { loadCfg(); }, [loadCfg]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    let arr = (listings || []).filter((l) => {
      const fm = l.fulfillment_mode || 'ship';
      return mode === 'pickup' ? fm === 'pickup' : fm !== 'pickup';
    });
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((l) => `${l.title} ${l.category || ''}`.toLowerCase().includes(s));
    }
    if (sort === 'price_asc') arr = [...arr].sort((a, b) => (a.price_usd || 0) - (b.price_usd || 0));
    if (sort === 'price_desc') arr = [...arr].sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0));
    return arr;
  }, [listings, mode, q, sort]);

  async function buy(listing, method, acknowledged) {
    setBusy(listing.id + method);
    try {
      const r = await base44.functions.invoke('purchaseMarketplaceListing', {
        listing_id: listing.id, payment_method: method, acknowledged_over_limit: !!acknowledged,
      });
      if (r.data?.affordability_warning) { setWarn({ listing, method, ...r.data }); return; }
      if (r.data?.blocked) { toast.error(r.data.message || 'That payment option isn\'t available.'); return; }
      if (r.data?.affiliate && r.data?.redirect_url) { window.open(r.data.redirect_url, '_blank', 'noopener,noreferrer'); return; }
      toast.success(method === 'card' ? 'Purchased! Your order is being processed.' : 'Purchased with points!');
      await load(); loadCfg();
    } catch (e) { toast.error(e?.data?.error || e.message || 'Purchase failed'); }
    finally { setBusy(''); setWarn(null); }
  }

  async function startLayaway(listing) {
    setBusy(listing.id + 'lay');
    try {
      const r = await base44.functions.invoke('layawayStart', { listing_id: listing.id });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(`Layaway started — about ${formatPrice(r.data.monthly_usd)}/mo over ${r.data.term_months} mo. Pay it down with points; it ships when paid off.`);
      loadCfg();
    } catch (e) { toast.error(e?.data?.error || 'Could not start layaway.'); }
    finally { setBusy(''); }
  }

  async function contribute(lay) {
    const val = Number(prompt(`How many points to put toward "${lay.item_name}"? (${lay.paid_points}/${lay.target_points} paid)`));
    if (!val || val <= 0) return;
    try {
      const r = await base44.functions.invoke('layawayContribute', { layaway_id: lay.id, points: val });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(r.data.completed ? 'Paid off — your item is on its way!' : `Applied ${val} points. ${r.data.remaining_points} to go.`);
      loadCfg();
    } catch (e) { toast.error(e?.data?.error || 'Could not apply points.'); }
  }

  const markupPct = cfg?.markup_pct ?? 10;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingBag className="h-6 w-6" /><h1 className="text-2xl font-bold">Buy Physical Items</h1>
      </div>

      {/* Purchase Payback tracker */}
      {payback && payback.spent_usd > 0 && (
        <Card className="mb-4 border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Purchase Payback — earning it back</span>
              <span>{formatPrice(payback.earned_back_usd)} / {formatPrice(payback.spent_usd)}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, payback.progress_pct)}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] text-white/80">{payback.disclosure}</div>
          </CardContent>
        </Card>
      )}

      {/* Mode chooser */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button onClick={() => setMode('ship')} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${mode === 'ship' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
          <Truck className="h-6 w-6 text-blue-600" />
          <div><div className="font-semibold">Buy online & ship</div><div className="text-xs text-gray-500">Delivered to your address</div></div>
        </button>
        <button onClick={() => setMode('pickup')} disabled={cfg && !cfg.modes?.pickup} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${mode === 'pickup' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'} disabled:opacity-50`}>
          <Store className="h-6 w-6 text-emerald-600" />
          <div><div className="font-semibold">Buy locally & pick up</div><div className="text-xs text-gray-500">Collect from a nearby store</div></div>
        </button>
      </div>

      {mode === 'pickup' && cfg?.pickup_note && <div className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{cfg.pickup_note}</div>}
      {cfg?.welcome_credit_usd > 0 && <div className="mb-3 text-sm text-purple-700">🎁 {formatPrice(cfg.welcome_credit_usd)} welcome credit applies automatically at checkout (up to the per-order cap).</div>}

      {/* Search + sort */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-8" placeholder="Search physical items…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="relevance">Relevance</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Layaways in progress */}
      {layaways.filter((l) => l.status === 'open').length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-sm font-semibold text-amber-800">Your layaways</div>
          {layaways.filter((l) => l.status === 'open').map((l) => (
            <div key={l.id} className="flex items-center justify-between py-1 text-sm">
              <span>{l.item_name} — {l.paid_points}/{l.target_points} pts (~{formatPrice(l.monthly_usd)}/mo)</span>
              <Button size="sm" variant="outline" onClick={() => contribute(l)}>Add points</Button>
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No {mode === 'pickup' ? 'local pickup' : 'shippable'} items yet — check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((l) => (
            <Card key={l.id} className="overflow-hidden">
              <CardContent className="p-3">
                {l.images?.[0] && <img src={l.images[0]} alt={l.title} className="mb-2 h-28 w-full rounded-lg object-cover" loading="lazy" />}
                <div className="line-clamp-2 text-sm font-semibold">{l.title}</div>
                {l.category && <Badge variant="secondary" className="mt-1 text-[10px]">{l.category}</Badge>}
                {mode === 'pickup' && l.pickup_location && <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700"><Store className="h-3 w-3" />{l.pickup_location}</div>}
                <div className="mt-2 space-y-1.5">
                  {/* Primary: credit card (+markup) */}
                  {l.price_usd > 0 && (
                    <Button size="sm" className="w-full" disabled={busy === l.id + 'card'} onClick={() => buy(l, 'card')}>
                      <CreditCard className="mr-1 h-4 w-4" /> {formatPrice(l.price_usd * (1 + markupPct / 100))}
                      <span className="ml-1 text-[10px] opacity-75">card</span>
                    </Button>
                  )}
                  {/* Points / surveys only */}
                  {l.price_points > 0 && (
                    <Button size="sm" variant="outline" className="w-full" disabled={busy === l.id + 'points'} onClick={() => buy(l, 'points')}>
                      <Coins className="mr-1 h-4 w-4" /> {Number(l.price_points).toLocaleString()} pts
                    </Button>
                  )}
                  {/* BNPL + Layaway */}
                  <div className="flex gap-1.5">
                    {cfg?.options?.affirm && l.price_usd > 0 && (
                      <Button size="sm" variant="ghost" className="flex-1 text-[11px]" onClick={() => toast.info('Affirm financing opens at checkout for eligible items.')}>
                        <Landmark className="mr-1 h-3.5 w-3.5" /> BNPL
                      </Button>
                    )}
                    {cfg?.options?.layaway && l.price_points > 0 && (
                      <Button size="sm" variant="ghost" className="flex-1 text-[11px]" disabled={busy === l.id + 'lay'} onClick={() => startLayaway(l)}>
                        <Clock className="mr-1 h-3.5 w-3.5" /> Layaway
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Affordability warning modal */}
      {warn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-2 flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /><span className="font-bold">Before you buy</span></div>
            <p className="text-sm text-gray-700">{warn.message}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setWarn(null)}>Go back</Button>
              <Button className="flex-1" onClick={() => buy(warn.listing, warn.method, true)}>Proceed anyway</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
