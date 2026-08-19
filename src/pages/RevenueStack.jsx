import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, TrendingUp, ShieldCheck, Layers, Users, RefreshCw } from 'lucide-react';

// RevenueStack — admin view of the BLENDED $200k/year revenue stack over a 5-year horizon.
// Reporting only: reads the revenueStackReport function. PPC advertiser LTV stays $12,000 (one line here).
const usd = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
const usd2 = (n) => `$${(Number(n || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';
const prettyType = (t) => String(t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function RevenueStack() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [notAdmin, setNotAdmin] = useState(false);
  const [days, setDays] = useState(90);
  const [err, setErr] = useState(null);

  const load = async (windowDays = days) => {
    setLoading(true); setErr(null);
    try {
      const me = await base44.auth.me().catch(() => null);
      if (me && me.role !== 'admin') { setNotAdmin(true); setLoading(false); return; }
      const res = await base44.functions.invoke('revenueStackReport', { days: windowDays, top: 8 });
      setData(res || null);
    } catch (e) {
      setErr(e?.message || 'Could not load the revenue stack.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(90);   }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (notAdmin) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">Admin only.</div>;

  const stack = data?.stack;
  const target = stack?.annual_target_usd || 200000;
  const annual = stack?.actual_annualized_usd || 0;
  const pct = stack?.pct_to_target || 0;
  const horizon = stack?.horizon_years || 5;
  const salesShare = stack ? (stack.sales_driven_annualized_usd || 0) : 0;
  const activityShare = stack ? (stack.activity_driven_annualized_usd || 0) : 0;
  const five = stack?.five_year;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6" style={{ color: NAVY }} />
          <h1 className="text-2xl font-bold" style={{ color: INK }}>Revenue Stack</h1>
          <Badge style={{ background: GOLD, color: INK }}>{usd(target)}/yr target · {horizon}-yr plan</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); load(d); }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5">
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => load(days)}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {err && <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">{err}</div>}

      {/* Progress to the $200k/yr target */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" style={{ color: NAVY }} />Progress to {usd(target)}/year</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div><p className="text-3xl font-extrabold" style={{ color: INK }}>{usd(annual)}</p><p className="text-xs text-gray-500">annualized run-rate (from last {stack?.window_days || days} days)</p></div>
            <div className="text-right"><p className="text-2xl font-bold" style={{ color: NAVY }}>{pct}%</p><p className="text-xs text-gray-500">of target · gap {usd(stack?.gap_to_target_usd)}</p></div>
          </div>
          <Progress value={Math.min(100, pct)} className="h-3" />
        </CardContent>
      </Card>

      {/* Sales-driven vs activity-driven + 5-year projection */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Sales-driven</p>
          <p className="text-2xl font-bold" style={{ color: INK }}>{usd(salesShare)}</p>
          <p className="text-xs text-gray-500">/yr · businesses you sign (advertisers, subscriptions, sponsorships)</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Activity-driven floor</p>
          <p className="text-2xl font-bold" style={{ color: NAVY }}>{usd(activityShare)}</p>
          <p className="text-xs text-gray-500">/yr · minted by member engagement ({stack?.activity_floor_pct || 0}% of run-rate)</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{horizon}-year cumulative</p>
          <p className="text-2xl font-bold" style={{ color: INK }}>{usd(five?.cumulative_usd)}</p>
          <p className="text-xs text-gray-500">at flat run-rate · plan target {usd(five?.target_cumulative_usd)}</p>
        </CardContent></Card>
      </div>

      {/* Per-line breakdown vs target blend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lines vs target blend</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Line</th><th className="py-2 px-3">Type</th>
              <th className="py-2 px-3 text-right">Annualized</th><th className="py-2 px-3 text-right">Target</th><th className="py-2 pl-3 text-right">% of target</th>
            </tr></thead>
            <tbody>
              {(stack?.lines || []).map((l) => (
                <tr key={l.type} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-gray-800">{prettyType(l.type)}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className={l.category === 'sales_driven' ? 'border-blue-300 text-blue-700' : 'border-emerald-300 text-emerald-700'}>
                      {l.category === 'sales_driven' ? 'sales' : 'activity'}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{usd2(l.actual_annualized_usd)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">{usd2(l.target_annual_usd)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums font-semibold" style={{ color: l.pct_of_target >= 100 ? '#059669' : NAVY }}>{l.pct_of_target}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top customers by 5-year value */}
      {Array.isArray(data?.top_customers) && data.top_customers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" style={{ color: NAVY }} />Top customers · {horizon}-year value</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Business</th><th className="py-2 px-3 text-right">Annualized</th><th className="py-2 pl-3 text-right">{horizon}-yr value</th>
              </tr></thead>
              <tbody>
                {data.top_customers.map((c) => (
                  <tr key={c.business_id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs text-gray-700">{c.business_id}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{usd2(c.annualized_usd)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums font-semibold" style={{ color: INK }}>{usd2(c.five_year?.cumulative_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400">{data?.note}</p>
      {stack && !stack.invariant_ok && (
        <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">Invariant breach: {usd(stack.customer_paid_usd)} recorded as customer-paid. Every stack dollar must come from a business or structural margin — never a customer markup.</div>
      )}
    </div>
  );
}
