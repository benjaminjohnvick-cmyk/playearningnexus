import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Plus, Loader2, Coins, CreditCard, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/components/locale/LocaleContext';
import CatalogWelcomeChat from '@/components/marketplace/CatalogWelcomeChat';
import { useVariant } from '@/components/experiments/VariantProvider';
import { reportMetric } from '@/lib/liveVariants';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Marketplace — Facebook-Marketplace-style listings. Three sources coexist: original platform catalog
// (AI-generated, AI-fulfilled), authorized affiliate products (retailer fulfills via affiliate link),
// and member listings. Buy with points (closed-loop) or by card (adds the platform markup). Prices
// render in the user's currency; sellers/platform fulfill via the AI fulfillment lifecycle.
// "Find the real thing" button, localized. Keyed by language code; falls back to English.
const REAL_SEARCH_LABEL = {
  en: 'Now go find the real thing',
  es: 'Busca el producto real',
  fr: 'Trouvez le vrai produit',
  de: 'Finde das echte Produkt',
  it: 'Trova il prodotto vero',
  pt: 'Encontre o produto real',
  ja: '本物を探す',
  ko: '실제 제품 찾기',
  hi: 'असली उत्पाद खोजें',
  nl: 'Vind het echte product',
  zh: '去找真实商品',
  ar: 'ابحث عن المنتج الحقيقي',
  ru: 'Найти настоящий товар',
  pl: 'Znajdź prawdziwy produkt',
  tr: 'Gerçeğini bul',
  sv: 'Hitta den riktiga varan',
  no: 'Finn den ekte varen',
  da: 'Find den ægte vare',
  fi: 'Löydä oikea tuote',
  el: 'Βρες το πραγματικό προϊόν',
  th: 'ค้นหาสินค้าจริง',
  id: 'Cari produk aslinya',
  vi: 'Tìm sản phẩm thật',
  ms: 'Cari produk sebenar',
};

export default function Marketplace() {
  const { formatPrice, language, country } = useLocale();
  // Reference live-experiment adoption: the buy CTA label. When an experiment named 'marketplace_buy_cta'
  // is running and this user is in the 'variant' arm, the label changes; otherwise it's the control.
  // Promotion/rollback happen server-side as a config flip — this component just ships both branches.
  const buyCta = useVariant('marketplace_buy_cta', 'control');
  const [markupPct, setMarkupPct] = useState(0);   // the 10% markup applies to points purchases too — show the marked-up price
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSell, setShowSell] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price_points: '', price_usd: '', category: 'general', condition: 'used', images: [], anonymous: false });
  const [busy, setBusy] = useState('');
  const [uploading, setUploading] = useState(false);
  // On-site listing search/sort/filter (best-practice marketplace controls).
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [catFilter, setCatFilter] = useState('all');
  // "Find the real thing" aggregated internet search modal.
  const [realSearch, setRealSearch] = useState({ open: false, listing: null, query: '', sort: 'relevance', minPrice: '', maxPrice: '', engines: [], loading: false, disclosure: '' });
  // Welcome rewards balance + advertised value figure.
  const [welcome, setWelcome] = useState(null);
  // Affirm BNPL checkout (real-goods only).
  const [affirm, setAffirm] = useState({ open: false, listing: null, name: '', address1: '', city: '', state: '', zipcode: '', loading: false });

  useEffect(() => {
    base44.functions.invoke('welcomeCreditStatus', {})
      .then((r) => setWelcome(r.data || null)).catch(() => {});
  }, []);

  // Source presentation: label + badge tint. Affiliate listings are clearly marked per FTC.
  function sourceMeta(l) {
    if (l.source === 'platform_catalog') return { label: 'GamerGain Official', tint: 'bg-red-600' };
    if (l.source === 'affiliate') return { label: l.source_label || 'Affiliate', tint: 'bg-amber-600' };
    return null;
  }

  // Compress an image to a small inline data URL — the no-S3 fallback so listings have photos today.
  function compressToDataUrl(file, maxDim = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      let url = null;
      // Prefer S3 (presigned) when configured; otherwise fall back to a compressed inline image.
      try { const res = await base44.integrations.Core.UploadFile({ file }); url = res?.file_url || null; } catch { url = null; }
      if (!url) url = await compressToDataUrl(file);
      if (url) setForm((f) => ({ ...f, images: [...(f.images || []), url] }));
    } catch { toast.error('Could not process that image.'); }
    finally { setUploading(false); }
  }

  async function load() {
    setLoading(true);
    try {
      // Prefer the shopper's own country's catalog (localized price + flag). Also pull member listings
      // (no country) so they always appear. Fall back to everything active if the country has none yet.
      let data = [];
      if (country) {
        const [local, member] = await Promise.all([
          base44.entities.MarketplaceListing.filter({ status: 'active', country }, '-created_at', 200).catch(() => []),
          base44.entities.MarketplaceListing.filter({ status: 'active', source: 'user' }, '-created_at', 100).catch(() => []),
        ]);
        data = [...(local || []), ...(member || [])];
      }
      if (!data.length) data = await base44.entities.MarketplaceListing.filter({ status: 'active' }, '-created_at', 200).catch(() => []);
      // De-dupe by id (local + member can overlap).
      const seen = new Set();
      setListings((data || []).filter((l) => (l.id && !seen.has(l.id)) ? seen.add(l.id) : false));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { base44.functions.invoke('physicalStoreConfig', {}).then((r) => setMarkupPct(r.data?.markup_pct || 0)).catch(() => {}); }, []);

  async function createListing() {
    if (!form.title || (!form.price_points && !form.price_usd)) { toast.error('Add a title and at least one price.'); return; }
    setBusy('create');
    try {
      // Anonymous listings route through relistItem (no name/PII shown); named listings use the
      // standard member-seller flow.
      const fn = form.anonymous ? 'relistItem' : 'createMarketplaceListing';
      await base44.functions.invoke(fn, {
        ...form,
        price_points: form.price_points ? Number(form.price_points) : null,
        price_usd: form.price_usd ? Number(form.price_usd) : null,
      });
      toast.success('Listing posted!');
      setShowSell(false);
      setForm({ title: '', description: '', price_points: '', price_usd: '', category: 'general', condition: 'used', images: [], anonymous: false });
      await load();
    } catch (e) { toast.error(e?.data?.error || e.message || 'Failed'); }
    finally { setBusy(''); }
  }

  // On-site listings filtered + sorted by the toolbar controls.
  const categories = React.useMemo(() => ['all', ...Array.from(new Set(listings.map((l) => l.category).filter(Boolean)))], [listings]);
  const visible = React.useMemo(() => {
    let arr = listings.slice();
    // Show the shopper's own country's catalog when we have it (each country carries its flag + local
    // pricing); otherwise fall back to everything active. Member listings (no country) always show.
    if (country) {
      const local = arr.filter((l) => !l.country || l.country === country);
      if (local.some((l) => l.country === country)) arr = local;
    }
    if (q.trim()) { const t = q.toLowerCase(); arr = arr.filter((l) => (l.title || '').toLowerCase().includes(t) || (l.description || '').toLowerCase().includes(t)); }
    if (catFilter !== 'all') arr = arr.filter((l) => l.category === catFilter);
    const price = (l) => (l.price_usd != null ? l.price_usd : (l.price_points || 0) / 100);
    if (sortBy === 'price_asc') arr.sort((a, b) => price(a) - price(b));
    else if (sortBy === 'price_desc') arr.sort((a, b) => price(b) - price(a));
    else arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // newest
    return arr;
  }, [listings, q, catFilter, sortBy, country]);

  // "Now go find the real thing" — opens an aggregated, sortable search across Amazon, Google Shopping
  // and eBay so real listings from across the internet come up. Sort + price range are honored per
  // engine. The platform listing stays original and priced in closed-loop points.
  async function openRealSearch(listing, override = {}) {
    const query = override.query != null ? override.query : (realSearch.open ? realSearch.query : (listing?.title || ''));
    const next = { open: true, listing, query, sort: override.sort ?? realSearch.sort ?? 'relevance', minPrice: override.minPrice ?? realSearch.minPrice ?? '', maxPrice: override.maxPrice ?? realSearch.maxPrice ?? '', engines: [], loading: true, disclosure: '' };
    setRealSearch(next);
    try {
      const res = await base44.functions.invoke('marketplaceSearchLink', {
        listing_id: listing?.id,
        query,
        sort: next.sort,
        min_price: next.minPrice ? Number(next.minPrice) : undefined,
        max_price: next.maxPrice ? Number(next.maxPrice) : undefined,
      });
      setRealSearch((s) => ({ ...s, engines: res.data?.engines || [], disclosure: res.data?.disclosure || '', loading: false }));
    } catch (e) { toast.error(e?.data?.error || e.message || 'Search failed'); setRealSearch((s) => ({ ...s, loading: false })); }
  }

  async function buy(listing, method) {
    setBusy(listing.id + method);
    try {
      const res = await base44.functions.invoke('purchaseMarketplaceListing', { listing_id: listing.id, payment_method: method });
      // Affiliate listing → open the retailer link (they sell + fulfill); nothing charged here.
      if (res.data?.affiliate && res.data?.redirect_url) {
        window.open(res.data.redirect_url, '_blank', 'noopener,noreferrer');
        toast.info('Opening the retailer to complete your purchase.');
        reportMetric('click_through');   // live-experiment outcome signal
      } else if (res.data?.blocked) toast.error(res.data.message || 'Payment method unavailable');
      else { toast.success(res.data?.charged ? 'Purchased! Your order is being fulfilled.' : 'Purchased!'); reportMetric('purchase'); await load(); }
    } catch (e) { toast.error(e?.data?.error || e.message || 'Purchase failed'); }
    finally { setBusy(''); }
  }

  // ---- Affirm BNPL (real, shippable goods only) ----
  function loadAffirm(publicKey) {
    return new Promise((resolve, reject) => {
      if (window.affirm) return resolve(window.affirm);
      window._affirm_config = { public_api_key: publicKey };
      const s = document.createElement('script');
      s.src = 'https://cdn1.affirm.com/js/v2/affirm.js';
      s.async = true;
      s.onload = () => resolve(window.affirm);
      s.onerror = () => reject(new Error('Affirm failed to load'));
      document.head.appendChild(s);
    });
  }
  async function submitAffirm() {
    const { listing, name, address1, city, state, zipcode } = affirm;
    if (!address1 || !city || !zipcode) { toast.error('Enter a shipping address.'); return; }
    setAffirm((a) => ({ ...a, loading: true }));
    try {
      const cfg = await base44.functions.invoke('affirmCheckoutConfig', {
        listing_id: listing.id, shipping: { name, address1, city, state, zipcode, country: 'USA' },
      });
      if (cfg.data?.blocked || !cfg.data?.checkout) { toast.error(cfg.data?.message || cfg.data?.error || 'Financing unavailable'); setAffirm((a) => ({ ...a, loading: false })); return; }
      const aff = await loadAffirm(cfg.data.checkout.merchant.public_api_key);
      aff.checkout(cfg.data.checkout);
      aff.checkout.open({
        onFail: () => { toast.error('Affirm checkout was cancelled.'); setAffirm((a) => ({ ...a, loading: false })); },
        onSuccess: async (res) => {
          try {
            const conf = await base44.functions.invoke('affirmConfirm', { listing_id: listing.id, checkout_token: res.checkout_token, shipping_address: { name, address1, city, state, zipcode } });
            if (conf.data?.success) { toast.success('Financed with Affirm — your order is being fulfilled.'); setAffirm({ open: false, listing: null, name: '', address1: '', city: '', state: '', zipcode: '', loading: false }); await load(); }
            else toast.error(conf.data?.error || 'Financing could not be completed.');
          } catch (e) { toast.error(e?.data?.error || e.message || 'Financing failed'); }
          finally { setAffirm((a) => ({ ...a, loading: false })); }
        },
      });
    } catch (e) { toast.error(e?.data?.error || e.message || 'Financing failed'); setAffirm((a) => ({ ...a, loading: false })); }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <CatalogWelcomeChat />
      <Link to={createPageUrl('PhysicalStore')} className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 p-4 text-white hover:opacity-95">
        <div>
          <div className="font-semibold">🛍️ Buy Physical Items</div>
          <div className="text-xs text-white/85">Ship to you or pick up locally · pay by card, points, Affirm, or layaway</div>
        </div>
        <span className="text-sm font-semibold">Shop →</span>
      </Link>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><ShoppingBag className="w-6 h-6" /><h1 className="text-2xl font-bold">Marketplace</h1></div>
        <Button size="sm" onClick={() => setShowSell((v) => !v)}><Plus className="w-4 h-4 mr-1" /> Sell an item</Button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">Buy from other members with points or card. Sellers ship their own items; funds release after delivery.</p>

      {/* Welcome rewards banner (advertised value figure + this user's remaining credit). */}
      {welcome && (welcome.advertised_value_usd > 0 || welcome.remaining_usd > 0) && (
        <div className="mb-4 rounded-lg bg-gradient-to-r from-red-600 to-rose-500 text-white p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold">
            🎁 Up to ${Number(welcome.advertised_value_usd).toLocaleString()} in first-year value
            {welcome.remaining_usd > 0 && !welcome.expired && (
              <span className="font-normal"> · you have <b>${Number(welcome.remaining_usd).toLocaleString()}</b> in welcome rewards to spend (covers up to {Math.round((welcome.max_pct || 0.2) * 100)}% per order)</span>
            )}
          </div>
          <span className="text-[11px] opacity-80">Non-cashable promotional credit; expires 12 months after signup. Terms apply.</span>
        </div>
      )}

      {showSell && (
        <Card className="mb-6">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input placeholder="Price in points" type="number" value={form.price_points} onChange={(e) => setForm({ ...form, price_points: e.target.value })} />
            <Input placeholder="Price in $ (card)" type="number" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: e.target.value })} />
            <Input className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="md:col-span-2">
              <label className="text-sm text-zinc-600">Photos</label>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {(form.images || []).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                ))}
                <label className="w-16 h-16 flex items-center justify-center rounded border border-dashed border-zinc-300 cursor-pointer text-zinc-400 text-xs">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Add'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
                </label>
              </div>
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} />
              List anonymously — hide my name (recommended when reselling something you bought)
            </label>
            <div className="md:col-span-2 flex justify-end">
              <Button size="sm" disabled={busy === 'create'} onClick={createListing}>
                {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Post listing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search / sort / filter toolbar for on-site listings. */}
      {!loading && listings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input className="pl-8" placeholder="Search listings…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="border rounded-md h-9 px-2 text-sm bg-white" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <select className="border rounded-md h-9 px-2 text-sm bg-white" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-zinc-400">{listings.length === 0 ? 'No listings yet — be the first to sell something.' : 'No listings match your search.'}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((l) => (
            <Card key={l.id} className="overflow-hidden">
              <div className="relative">
                {(l.image_url || l.images?.[0]) && <img src={l.image_url || l.images[0]} alt={l.title} className="w-full h-40 object-cover" />}
                {/* Points price overlaid on the image (1 point = 1¢ in the local currency, closed-loop). */}
                {l.price_points > 0 && (
                  <span className="absolute top-2 left-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {Math.round(l.price_points * (1 + markupPct / 100)).toLocaleString()} pts
                  </span>
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{l.title}</div>
                  <Badge className="bg-zinc-500 text-white">{l.condition}</Badge>
                </div>
                {sourceMeta(l) && (
                  <Badge className={`${sourceMeta(l).tint} text-white mb-1`}>{sourceMeta(l).label}</Badge>
                )}
                <div className="text-xs text-zinc-500 mb-2 line-clamp-2">{l.description}</div>
                <div className="text-xs text-zinc-500 mb-2">by {l.seller_name || 'Member'}{l.location ? ` · ${l.location}` : ''}</div>
                {l.source === 'affiliate' ? (
                  <Button size="sm" disabled={busy === l.id + 'card'} onClick={() => buy(l, 'card')}>
                    <ExternalLink className="w-4 h-4 mr-1" /> View{l.price_usd > 0 ? ` · ${formatPrice(l.price_usd)}` : ''}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    {l.price_points > 0 && (
                      <Button size="sm" variant="outline" disabled={busy === l.id + 'points'} onClick={() => buy(l, 'points')}>
                        <Coins className="w-4 h-4 mr-1" /> {Math.round(l.price_points * (1 + markupPct / 100)).toLocaleString()} pts
                      </Button>
                    )}
                    {l.price_usd > 0 && (
                      <Button size="sm" disabled={busy === l.id + 'card'} onClick={() => buy(l, 'card')}>
                        <CreditCard className="w-4 h-4 mr-1" /> {buyCta === 'variant' ? `Buy · ${formatPrice(l.price_usd)}` : formatPrice(l.price_usd)}
                      </Button>
                    )}
                  </div>
                )}
                {/* Finance a real, shippable item with Affirm (never points/affiliate). Shows only when
                    Affirm is enabled server-side; the config call gates eligibility. */}
                {l.source !== 'affiliate' && l.price_usd > 0 && (
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs"
                    onClick={() => setAffirm({ open: true, listing: l, name: '', address1: '', city: '', state: '', zipcode: '', loading: false })}>
                    <CreditCard className="w-3 h-3 mr-1" /> Pay over time with Affirm
                  </Button>
                )}
                {l.source !== 'affiliate' && (
                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs" onClick={() => openRealSearch(l)}>
                    <Search className="w-3 h-3 mr-1" /> {REAL_SEARCH_LABEL[l.language || language] || REAL_SEARCH_LABEL.en}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* "Find the real thing" — full-screen AI search: editable query bar, in-app catalog matches,
          and sorted real listings from across the web. */}
      {realSearch.open && (() => {
        const t = (realSearch.query || '').toLowerCase();
        const matches = t ? listings.filter((l) => (l.title || '').toLowerCase().includes(t) || (l.category || '').toLowerCase().includes(t) || (l.description || '').toLowerCase().includes(t)) : listings;
        return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* AI search bar */}
          <div className="border-b p-3 flex items-center gap-2 sticky top-0 bg-white z-10">
            <button className="text-zinc-500 text-2xl leading-none px-1" onClick={() => setRealSearch((s) => ({ ...s, open: false }))}>×</button>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input className="pl-9" placeholder="Search products…" value={realSearch.query}
                onChange={(e) => setRealSearch((s) => ({ ...s, query: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') openRealSearch(realSearch.listing, { query: realSearch.query }); }} />
            </div>
            <Button size="sm" onClick={() => openRealSearch(realSearch.listing, { query: realSearch.query })}>Search</Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 p-3 border-b bg-zinc-50">
            <select className="border rounded-md h-9 px-2 text-sm bg-white"
              value={realSearch.sort}
              onChange={(e) => openRealSearch(realSearch.listing, { query: realSearch.query, sort: e.target.value, minPrice: realSearch.minPrice, maxPrice: realSearch.maxPrice })}>
              <option value="relevance">Best match</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Avg. customer review</option>
              <option value="newest">Newest</option>
            </select>
            <Input className="w-24" type="number" placeholder="Min $" value={realSearch.minPrice}
              onChange={(e) => setRealSearch((s) => ({ ...s, minPrice: e.target.value }))} />
            <Input className="w-24" type="number" placeholder="Max $" value={realSearch.maxPrice}
              onChange={(e) => setRealSearch((s) => ({ ...s, maxPrice: e.target.value }))} />
            <Button size="sm" variant="outline" onClick={() => openRealSearch(realSearch.listing, { query: realSearch.query, sort: realSearch.sort, minPrice: realSearch.minPrice, maxPrice: realSearch.maxPrice })}>Apply</Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Real listings from across the web */}
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Real listings from across the web</div>
              {realSearch.loading ? (
                <div className="py-2 flex items-center gap-2 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Building results…</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {realSearch.engines.map((e) => (
                    <Button key={e.key} variant="outline" onClick={() => window.open(e.url, '_blank', 'noopener,noreferrer')}>
                      <ExternalLink className="w-4 h-4 mr-1" /> {e.label}
                      {e.affiliate ? <Badge className="bg-amber-600 text-white text-[10px] ml-2">affiliate</Badge> : null}
                    </Button>
                  ))}
                </div>
              )}
              {realSearch.disclosure ? <div className="text-[11px] text-zinc-400 pt-1">{realSearch.disclosure}</div> : null}
            </div>

            {/* In-app catalog matches (buyable with points, closed-loop) */}
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> In the GamerGain catalog</div>
            {matches.length === 0 ? (
              <div className="text-sm text-zinc-400">No catalog matches — try the web listings above.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {matches.slice(0, 60).map((l) => (
                  <Card key={l.id} className="overflow-hidden">
                    <div className="relative">
                      {(l.image_url || l.images?.[0]) && <img src={l.image_url || l.images[0]} alt={l.title} className="w-full h-28 object-cover" />}
                      {l.price_points > 0 && (
                        <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {Math.round(l.price_points * (1 + markupPct / 100)).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <CardContent className="p-2">
                      <div className="text-xs font-medium truncate">{l.title}</div>
                      <div className="flex gap-1 mt-1">
                        {l.price_points > 0 && (
                          <Button size="sm" variant="outline" className="text-[11px] h-7 px-2" disabled={busy === l.id + 'points'} onClick={() => buy(l, 'points')}>
                            <Coins className="w-3 h-3 mr-1" /> Buy
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Affirm financing — collect shipping, then open Affirm.js (real shippable goods only). */}
      {affirm.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAffirm((a) => ({ ...a, open: false }))}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pay over time with Affirm</div>
                <button className="text-zinc-400 text-xl leading-none" onClick={() => setAffirm((a) => ({ ...a, open: false }))}>×</button>
              </div>
              <div className="text-xs text-zinc-500 mb-3 truncate">{affirm.listing?.title} · {affirm.listing ? formatPrice(affirm.listing.price_usd) : ''}</div>
              <div className="grid grid-cols-1 gap-2">
                <Input placeholder="Full name" value={affirm.name} onChange={(e) => setAffirm((a) => ({ ...a, name: e.target.value }))} />
                <Input placeholder="Address" value={affirm.address1} onChange={(e) => setAffirm((a) => ({ ...a, address1: e.target.value }))} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="City" value={affirm.city} onChange={(e) => setAffirm((a) => ({ ...a, city: e.target.value }))} />
                  <Input placeholder="State" value={affirm.state} onChange={(e) => setAffirm((a) => ({ ...a, state: e.target.value }))} />
                  <Input placeholder="ZIP" value={affirm.zipcode} onChange={(e) => setAffirm((a) => ({ ...a, zipcode: e.target.value }))} />
                </div>
                <Button size="sm" disabled={affirm.loading} onClick={submitAffirm}>
                  {affirm.loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />} Continue with Affirm
                </Button>
                <div className="text-[11px] text-zinc-400">Affirm decides your rate and terms. Financing is for real, shippable products only — never points or credit.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
