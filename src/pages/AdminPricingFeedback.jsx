import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Admin view of the pricing-sensitivity data the AI collects (PricingFeedback). Surfaces the
// willingness-to-pay signal the AI pricing optimizer reads: response volume, average acceptable
// price, buy-intent, a per-target breakdown, and the most recent responses.
export default function AdminPricingFeedback() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await base44.entities.PricingFeedback.list('-collected_at', 1000).catch(() => []);
      setRows(data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const prices = rows.map((r) => Number(r.price_point)).filter((n) => Number.isFinite(n));
    const avg = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : 0;
    const buys = rows.filter((r) => r.would_buy === true).length;
    const byTarget = {};
    for (const r of rows) {
      const t = r.target || 'general';
      (byTarget[t] ||= { count: 0, sum: 0, n: 0, buys: 0 });
      byTarget[t].count++;
      if (r.would_buy) byTarget[t].buys++;
      const p = Number(r.price_point);
      if (Number.isFinite(p)) { byTarget[t].sum += p; byTarget[t].n++; }
    }
    const targets = Object.entries(byTarget).map(([target, v]) => ({
      target, count: v.count, avg: v.n ? Math.round((v.sum / v.n) * 100) / 100 : 0,
      buyRate: v.count ? Math.round((v.buys / v.count) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
    return { total: rows.length, avg, buyRate: rows.length ? Math.round((buys / rows.length) * 100) : 0, targets };
  }, [rows]);

  if (loading) return <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading pricing feedback…</div>;

  const stat = (label, value) => (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2"><DollarSign className="w-6 h-6" /><h1 className="text-2xl font-bold">Pricing Feedback</h1></div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      <p className="text-sm text-zinc-500 mb-6">Willingness-to-pay data from AI-generated pricing surveys. The pricing optimizer reads this to recommend price changes.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {stat('Responses', summary.total.toLocaleString())}
        {stat('Avg acceptable price', `$${summary.avg}`)}
        {stat('Would buy', `${summary.buyRate}%`)}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">By target</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {summary.targets.length === 0 && <div className="text-sm text-zinc-400">No pricing feedback collected yet. Generate a pricing survey from the AI Optimization page.</div>}
          {summary.targets.map((t) => (
            <div key={t.target} className="flex items-center justify-between rounded-lg border border-zinc-200 p-2 text-sm">
              <span className="font-medium">{t.target}</span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">avg ${t.avg}</span>
                <Badge className="bg-emerald-600 text-white">{t.buyRate}% buy</Badge>
                <span className="text-xs text-zinc-400">{t.count} responses</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent responses</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {rows.slice(0, 50).map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-zinc-100 py-1.5 text-sm">
              <span className="text-zinc-600">{r.target || 'general'}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{Number.isFinite(Number(r.price_point)) ? `$${r.price_point}` : '—'}</span>
                <Badge className={`${r.would_buy ? 'bg-emerald-600' : 'bg-zinc-400'} text-white`}>{r.would_buy ? 'would buy' : 'no'}</Badge>
                <span className="text-xs text-zinc-400">{r.collected_at ? new Date(r.collected_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-zinc-400">No responses yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
