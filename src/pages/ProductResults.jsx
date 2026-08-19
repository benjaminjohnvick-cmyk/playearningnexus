import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

// ProductResults — compiled statistics on anything sold. Published products show real "typical order" results
// (median/avg, orders, buyers) with a basis; the rest are "gathering data" (show how it works). Read-only.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function ProductResults() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState(null);
  const [onlyPublished, setOnlyPublished] = useState(false);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await base44.functions.invoke('productStats', { published_only: onlyPublished, limit: 200 });
      setProducts(res?.products ?? []);
      if (res?.error) setErr(res.error);
    } catch (e) { setErr(e?.message || 'Could not load product stats.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load();   }, [onlyPublished]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const published = products.filter((p) => p.published).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6" style={{ color: NAVY }} />
          <h1 className="text-2xl font-bold" style={{ color: INK }}>Product Results</h1>
          <Badge style={{ background: GOLD, color: INK }}>{published} published · {products.length} tracked</Badge>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={onlyPublished} onChange={(e) => setOnlyPublished(e.target.checked)} />published only</label>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {err && <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">{err}</div>}

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="py-2.5 px-4">Product</th>
            <th className="py-2.5 px-3 text-right">Typical order</th>
            <th className="py-2.5 px-3 text-right">Orders</th>
            <th className="py-2.5 px-3 text-right">Buyers</th>
            <th className="py-2.5 px-3 text-right">Revenue</th>
            <th className="py-2.5 px-4">Status</th>
          </tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.item} className="border-b last:border-0">
                <td className="py-2 px-4 font-medium text-gray-800">{p.item}</td>
                <td className="py-2 px-3 text-right tabular-nums">{p.published ? money(p.revenue_value_usd) : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums">{p.sample_size}</td>
                <td className="py-2 px-3 text-right tabular-nums">{p.buyers}</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-500">{p.published ? money(p.revenue_total_usd) : '—'}</td>
                <td className="py-2 px-4">
                  {p.published
                    ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />published</span>
                    : <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><Clock className="w-3.5 h-3.5" />gathering ({p.sample_size})</span>}
                </td>
              </tr>
            ))}
            {!products.length && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No product stats yet — run the compiler (or wait for the daily job).</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <p className="text-xs text-gray-400">Published rows are real results (median/average of actual orders, with a basis). "Gathering" products haven't reached the sample threshold, so the site shows how they work rather than a typical result — no claim is made until the data supports it.</p>
    </div>
  );
}
