import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { TrendingUp, TrendingDown, DollarSign, Loader2, ArrowUpRight, Rocket } from 'lucide-react';

const usd = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Profit (admin) — the plain "what's my profit" view: money in vs money out (routed through PayPal), and the
 * net. For the reserve-aware "what's safe to withdraw" number, links to the Growth Engine.
 */
export default function Profit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('profitSummary', { days: Number(days) || 30 }); setData(res?.data || null); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><DollarSign className="w-7 h-7 text-emerald-600" /><h1 className="text-3xl font-bold">Profit</h1></div>
        <div className="flex items-center gap-2">
          <select className="border rounded-md h-9 px-2 text-sm bg-white" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option>
          </select>
          <Button size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Adding it up…</div>
      ) : !data ? (
        <div className="text-slate-400">No data yet.</div>
      ) : (
        <>
          <Card className={`mb-6 border-0 shadow-lg text-white bg-gradient-to-r ${data.profit_usd >= 0 ? 'from-emerald-600 to-teal-600' : 'from-rose-600 to-red-600'}`}>
            <CardContent className="p-6">
              <div className="text-sm text-white/80">Profit ({data.window_days} days)</div>
              <div className="text-4xl font-black">{usd(data.profit_usd)}</div>
              <div className="text-sm text-white/85 mt-1">{usd(data.total_in_usd)} in − {usd(data.total_out_usd)} out{data.paypal_business_email ? ` · ${data.paypal_business_email}` : ''}</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-emerald-700"><TrendingUp className="w-4 h-4" /> Money in</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row k="PayPal payments in" v={usd(data.money_in_usd)} />
                <Row k="Business revenue" v={usd(data.business_revenue_usd)} />
                <Row k="Total in" v={usd(data.total_in_usd)} bold />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-rose-700"><TrendingDown className="w-4 h-4" /> Money out</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row k="PayPal funded (discounts)" v={usd(data.money_out_usd)} />
                <Row k="Subsidies (perks)" v={usd(data.subsidies_usd)} />
                <Row k="Expenses" v={usd(data.expenses_usd)} />
                <Row k="Total out" v={usd(data.total_out_usd)} bold />
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6 border-indigo-200 bg-indigo-50">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-indigo-800">
                <Rocket className="w-4 h-4 inline mr-1" /> Want the reserve-aware number that's actually safe to withdraw (after honoring outstanding points)?
              </div>
              <Link to={createPageUrl('GrowthEngine')}><Button size="sm" variant="outline">Open Growth Engine <ArrowUpRight className="w-4 h-4 ml-1" /></Button></Link>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-400">{data.note}</p>
        </>
      )}
    </div>
  );
}

function Row({ k, v, bold }) {
  return <div className={`flex items-center justify-between ${bold ? 'font-bold border-t pt-1 mt-1' : ''}`}><span className="text-slate-500">{k}</span><span>{v}</span></div>;
}
