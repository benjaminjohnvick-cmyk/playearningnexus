import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * WishlistSplit — pick products you want (added to your wishlist), let the AI keep suggesting more, and see
 * the list split into "You added" and "Picked for you". Part of the profile/KYC flow.
 */
export default function WishlistSplit() {
  const [mine, setMine] = useState([]);
  const [ai, setAi] = useState([]);
  const [rows, setRows] = useState(Array(10).fill(''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(async () => {
    try { const res = await base44.functions.invoke('wishlistGet', {}); setMine(res.data?.mine || []); setAi(res.data?.ai || []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setRow = (i, v) => setRows((r) => r.map((x, idx) => (idx === i ? v : x)));

  const save = async () => {
    const products = rows.map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
    if (!products.length) { toast.message('Add a few products first.'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('addWishlistProducts', { products });
      toast.success(`Added ${res.data?.added || 0} to your wishlist.`);
      setRows(Array(10).fill('')); await load();
    } catch { toast.error('Could not save.'); } finally { setSaving(false); }
  };

  const suggest = async () => {
    setSuggesting(true);
    try { const res = await base44.functions.invoke('wishlistAISuggest', { count: 6 }); toast.success(`AI added ${res.data?.added || 0} picks.`); await load(); }
    catch { toast.error('Could not get suggestions.'); } finally { setSuggesting(false); }
  };

  return (
    <Card className="border-2 border-rose-100 mt-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><Heart className="w-5 h-5 text-rose-500" /><h3 className="font-bold">Your wishlist</h3></div>
        <p className="text-xs text-slate-500 mb-3">Name up to 10 products you want — they go straight to your wishlist. The AI will keep adding more it thinks you'll like.</p>

        {/* 10-product picker */}
        <div className="grid sm:grid-cols-2 gap-1.5 mb-2">
          {rows.map((v, i) => (
            <input key={i} value={v} onChange={(e) => setRow(i, e.target.value)} placeholder={`Product ${i + 1}`}
              className="border rounded-md px-2 py-1.5 text-sm" maxLength={200} />
          ))}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Button size="sm" disabled={saving} onClick={save}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add to wishlist</>}</Button>
          <Button size="sm" variant="outline" disabled={suggesting} onClick={suggest}>{suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> Get AI picks</>}</Button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">You added ({mine.length})</div>
              <div className="space-y-1">
                {mine.length ? mine.slice(0, 30).map((w) => <div key={w.id} className="text-sm px-2 py-1 rounded bg-slate-50 truncate">{w.product_name}</div>)
                  : <div className="text-xs text-slate-400">Nothing yet.</div>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-rose-600 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Picked for you ({ai.length})</div>
              <div className="space-y-1">
                {ai.length ? ai.slice(0, 30).map((w) => <div key={w.id} className="text-sm px-2 py-1 rounded bg-rose-50 truncate">{w.product_name}</div>)
                  : <div className="text-xs text-slate-400">Tap "Get AI picks" to fill this.</div>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
