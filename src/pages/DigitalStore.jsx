import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, CreditCard, Coins, Clock, Loader2, Search, AlertTriangle, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/components/locale/LocaleContext';

// DigitalStore — the "Digital Products" section: intangible goods delivered ONLINE INSTANTLY (no
// shipping, no local pickup). Same parity + constraints as the physical store — search/sort, localized
// pricing, serverless-GPU category tiles, promotional (welcome) credit, affordability warning, and the
// earn-back tracker — with two deliberate differences: (1) online delivery only, and (2) NO Affirm BNPL
// (financing is restricted to real shippable goods, never digital). Payment: Credit card (default,
// +markup) · Points/surveys-only · Layaway (pay it down first, then it unlocks). Marked-up points shown.
export default function DigitalStore() {
  const { formatPrice } = useLocale();
  const [cfg, setCfg] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [busy, setBusy] = useState('');
  const [warn, setWarn] = useState(null);
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
      const data = await base44.entities.MarketplaceListing.filter({ status: 'active' }, '-created_at', 300).catch(() => []);
      setListings(data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCfg(); }, [loadCfg]);
  useEffect(() => { load(); }, [load]);

  const digitalSet = useMemo(() => new Set((cfg?.digital_categories || []).map((c) => String(c).toLowerCase())), [cfg]);
  const markupPct = cfg?.markup_pct ?? 10;

  const shown = useMemo(() => {
    let arr = (listings || []).filter((l) =>
      l.fulfillment_mode === 'digital' || l.product_type === 'digital' || digitalSet.has(String(l.category || '').toLowerCase()));
    if (q.trim()) { const s = q.toLowerCase(); arr = arr.filter((l) => `${l.title} ${l.category || ''}`.toLowerCase().includes(s)); }
    if (sort === 'price_asc') arr = [...arr].sort((a, b) => (a.price_usd || 0) - (b.price_usd || 0));
    if (sort === 'price_desc') arr = [...arr].sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0));
    return arr;
  }, [listings, digitalSet, q, sort]);

  async function buy(listing, method, acknowledged) {
    setBusy(listing.id + method);
    try {
      const r = await base44.functions.invoke('purchaseMarketplaceListing', { listing_id: listing.id, payment_method: method, acknowledged_over_limit: !!acknowledged });
      if (r.data?.affordability_warning) { setWarn({ listing, method, ...r.data }); return; }
      if (r.data?.blocked) { toast.error(r.data.message || 'That payment option isn\'t available.'); return; }
      if (r.data?.affiliate && r.data?.redirect_url) { window.open(r.data.redirect_url, '_blank', 'noopener,noreferrer'); return; }
      toast.success(method === 'card' ? 'Purchased! Your download/access is ready.' : 'Purchased with points! Your download/access is ready.');
      await load(); loadCfg();
    } catch (e) { toast.error(e?.data?.error || e.message || 'Purchase failed'); }
    finally { setBusy(''); setWarn(null); }
  }

  async function startLayaway(listing) {
    setBusy(listing.id + 'lay');
    try {
      const r = await base44.functions.invoke('layawayStart', { listing_id: listing.id });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(`Reserved — about ${formatPrice(r.data.monthly_usd)}/mo. Pay it down with points; it unlocks when paid off.`);
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
      toast.success(r.data.completed ? 'Paid off — your item is unlocked!' : `Applied ${val} points. ${r.data.remaining_points} to go.`);
      loadCfg();
    } catch (e) { toast.error(e?.data?.error || 'Could not apply points.'); }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-1 flex items-center gap-2"><Cloud className="h-6 w-6" /><h1 className="text-2xl font-bold">Digital Products</h1></div>
      <p className="mb-4 text-sm text-gray-500 flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Delivered online instantly — no shipping.</p>

      {/* Prominent product search — the first thing you see, with light placeholder text so it's obvious. */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for products…"
            aria-label="Search for digital products"
            className="h-14 w-full rounded-full border-gray-300 bg-white pl-12 pr-4 text-base placeholder:text-gray-400 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-300"
          />
        </div>
      </div>

      {payback && payback.spent_usd > 0 && (
        <Card className="mb-4 border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Purchase Payback — earning it back</span>
              <span>{formatPrice(payback.earned_back_usd)} / {formatPrice(payback.spent_usd)}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, payback.progress_pct)}%` }} /></div>
            <div className="mt-1.5 text-[11px] text-white/80">{payback.disclosure}</div>
          </CardContent>
        </Card>
      )}

      {cfg?.welcome_credit_usd > 0 && <div className="mb-3 text-sm text-purple-700">🎁 {formatPrice(cfg.welcome_credit_usd)} welcome credit applies automatically at checkout (up to the per-order cap).</div>}

      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{shown.length} product{shown.length === 1 ? '' : 's'}{q.trim() ? ` for “${q.trim()}”` : ''}</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="relevance">Relevance</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {layaways.filter((l) => l.status === 'open').length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-sm font-semibold text-amber-800">Your reservations</div>
          {layaways.filter((l) => l.status === 'open').map((l) => (
            <div key={l.id} className="flex items-center justify-between py-1 text-sm">
              <span>{l.item_name} — {l.paid_points}/{l.target_points} pts (~{formatPrice(l.monthly_usd)}/mo)</span>
              <Button size="sm" variant="outline" onClick={() => contribute(l)}>Add points</Button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No digital products yet — check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((l) => (
            <Card key={l.id} className="overflow-hidden">
              <CardContent className="p-3">
                {l.images?.[0] && <img src={l.images[0]} alt={l.title} className="mb-2 h-28 w-full rounded-lg object-cover" loading="lazy" />}
                <div className="line-clamp-2 text-sm font-semibold">{l.title}</div>
                {l.category && <Badge variant="secondary" className="mt-1 text-[10px]">{l.category}</Badge>}
                <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600"><Download className="h-3 w-3" /> Instant online delivery</div>
                <div className="mt-2 space-y-1.5">
                  {l.price_usd > 0 && (
                    <Button size="sm" className="w-full" disabled={busy === l.id + 'card'} onClick={() => buy(l, 'card')}>
                      <CreditCard className="mr-1 h-4 w-4" /> {formatPrice(l.price_usd * (1 + markupPct / 100))}
                      <span className="ml-1 text-[10px] opacity-75">card</span>
                    </Button>
                  )}
                  {l.price_points > 0 && (
                    <Button size="sm" variant="outline" className="w-full" disabled={busy === l.id + 'points'} onClick={() => buy(l, 'points')}>
                      <Coins className="mr-1 h-4 w-4" /> {Math.round(l.price_points * (1 + markupPct / 100)).toLocaleString()} pts
                    </Button>
                  )}
                  {cfg?.options?.layaway && l.price_points > 0 && (
                    <Button size="sm" variant="ghost" className="w-full text-[11px]" disabled={busy === l.id + 'lay'} onClick={() => startLayaway(l)}>
                      <Clock className="mr-1 h-3.5 w-3.5" /> Reserve & pay with points
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
