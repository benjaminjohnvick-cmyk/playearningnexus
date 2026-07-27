import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Plus, Loader2, Coins, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

// Marketplace — Facebook-Marketplace-style peer listings. Buy with points (closed-loop) or by card
// (adds the platform markup). Sellers ship; the AI fulfillment lifecycle handles escrow + release.
export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSell, setShowSell] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price_points: '', price_usd: '', category: 'general', condition: 'used', images: [] });
  const [busy, setBusy] = useState('');
  const [uploading, setUploading] = useState(false);

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
      const data = await base44.entities.MarketplaceListing.filter({ status: 'active' }, '-created_at', 200).catch(() => []);
      setListings(data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createListing() {
    if (!form.title || (!form.price_points && !form.price_usd)) { toast.error('Add a title and at least one price.'); return; }
    setBusy('create');
    try {
      await base44.functions.invoke('createMarketplaceListing', {
        ...form,
        price_points: form.price_points ? Number(form.price_points) : null,
        price_usd: form.price_usd ? Number(form.price_usd) : null,
      });
      toast.success('Listing posted!');
      setShowSell(false);
      setForm({ title: '', description: '', price_points: '', price_usd: '', category: 'general', condition: 'used', images: [] });
      await load();
    } catch (e) { toast.error(e?.data?.error || e.message || 'Failed'); }
    finally { setBusy(''); }
  }

  async function buy(listing, method) {
    setBusy(listing.id + method);
    try {
      const res = await base44.functions.invoke('purchaseMarketplaceListing', { listing_id: listing.id, payment_method: method });
      if (res.data?.blocked) toast.error(res.data.message || 'Payment method unavailable');
      else { toast.success('Purchased! The seller will ship your item.'); await load(); }
    } catch (e) { toast.error(e?.data?.error || e.message || 'Purchase failed'); }
    finally { setBusy(''); }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><ShoppingBag className="w-6 h-6" /><h1 className="text-2xl font-bold">Marketplace</h1></div>
        <Button size="sm" onClick={() => setShowSell((v) => !v)}><Plus className="w-4 h-4 mr-1" /> Sell an item</Button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">Buy from other members with points or card. Sellers ship their own items; funds release after delivery.</p>

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
            <div className="md:col-span-2 flex justify-end">
              <Button size="sm" disabled={busy === 'create'} onClick={createListing}>
                {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Post listing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : listings.length === 0 ? (
        <div className="text-sm text-zinc-400">No listings yet — be the first to sell something.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <Card key={l.id} className="overflow-hidden">
              {l.images?.[0] && <img src={l.images[0]} alt={l.title} className="w-full h-40 object-cover" />}
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{l.title}</div>
                  <Badge className="bg-zinc-500 text-white">{l.condition}</Badge>
                </div>
                <div className="text-xs text-zinc-500 mb-2 line-clamp-2">{l.description}</div>
                <div className="text-xs text-zinc-500 mb-2">by {l.seller_name || 'Member'}{l.location ? ` · ${l.location}` : ''}</div>
                <div className="flex gap-2">
                  {l.price_points > 0 && (
                    <Button size="sm" variant="outline" disabled={busy === l.id + 'points'} onClick={() => buy(l, 'points')}>
                      <Coins className="w-4 h-4 mr-1" /> {l.price_points} pts
                    </Button>
                  )}
                  {l.price_usd > 0 && (
                    <Button size="sm" disabled={busy === l.id + 'card'} onClick={() => buy(l, 'card')}>
                      <CreditCard className="w-4 h-4 mr-1" /> ${l.price_usd}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
