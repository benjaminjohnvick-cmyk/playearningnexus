import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, ShieldCheck, CheckCircle2, Plus, X } from 'lucide-react';

// SaveToGet — no-debt "save toward an item from your own earnings" page. Create goals, add savings at your
// own pace (or auto-route a % of new earnings), claim when funded, cancel to get your savings back. Nothing
// is advanced and nothing is owed — it's the compliant replacement for goods_advance.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function SaveToGet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nm, setNm] = useState(''); const [price, setPrice] = useState(''); const [autoPct, setAutoPct] = useState('0');
  const [amt, setAmt] = useState({});
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try { const res = await base44.functions.invoke('saveToGetStatus', {}); setData(res || null); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load();   }, []);

  const call = async (fn, payload, ok) => {
    setBusy(true); setMsg(null);
    try {
      const res = await base44.functions.invoke(fn, payload);
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: res?.note || ok }); await load(); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data?.enabled) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">Save-to-Get is unavailable.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Target className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Save-to-Get</h1>
        <Badge style={{ background: GOLD, color: INK }}>no debt · your own earnings</Badge>
      </div>
      <p className="text-sm text-gray-600">Save toward any item from what you earn, at your own pace. When your savings reach the price, you claim it. It's your own Site Cash the whole time — move it back anytime, nothing is owed.</p>

      {/* Create a goal */}
      <Card><CardContent className="p-5 space-y-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Plus className="w-4 h-4" style={{ color: NAVY }} />New savings goal</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Item name" value={nm} onChange={(e) => setNm(e.target.value)} className="sm:col-span-2" />
          <div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Auto-save this % of new earnings toward it:</span>
          {[0, 10, 25, 50].map((p) => (
            <button key={p} onClick={() => setAutoPct(String(p))} className={`px-2.5 py-1 rounded-full text-xs border ${Number(autoPct) === p ? 'text-white border-transparent' : 'border-gray-300 text-gray-600'}`} style={Number(autoPct) === p ? { background: NAVY } : undefined}>{p === 0 ? 'Off' : `${p}%`}</button>
          ))}
        </div>
        <Button disabled={busy || !nm || !(Number(price) > 0)} className="bg-[#16264f] hover:bg-[#0a142e]"
          onClick={() => call('saveToGetCreate', { item_name: nm, item_price_usd: Number(price), auto_pct: Number(autoPct) / 100 }, 'Goal created.').then(() => { setNm(''); setPrice(''); setAutoPct('0'); })}>
          Create goal
        </Button>
      </CardContent></Card>

      {/* Goals */}
      {(data.goals || []).filter((g) => !['canceled'].includes(g.status)).map((g) => (
        <Card key={g.id}><CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-gray-900">{g.item_name}</p>
              <p className="text-xs text-gray-500">{money(g.saved_usd)} saved of {money(g.item_price_usd)}{g.auto_pct > 0 ? ` · auto ${Math.round(g.auto_pct * 100)}%` : ''}</p>
            </div>
            {g.funded ? <Badge className="bg-emerald-100 text-emerald-800">funded</Badge> : g.status === 'claimed' ? <Badge variant="outline">claimed</Badge> : <Badge variant="outline" className="border-gray-300 text-gray-500">{g.progress_pct}%</Badge>}
          </div>
          <Progress value={g.progress_pct} className="h-2.5" />
          {g.status !== 'claimed' && (
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex items-center gap-1"><span className="text-gray-400">$</span>
                <Input type="number" min="0" placeholder="0" value={amt[g.id] || ''} onChange={(e) => setAmt((a) => ({ ...a, [g.id]: e.target.value }))} className="w-24 h-9" />
              </div>
              <Button size="sm" variant="outline" disabled={busy || !(Number(amt[g.id]) > 0)} onClick={() => call('saveToGetContribute', { goal_id: g.id, amount_usd: Number(amt[g.id]) }, 'Saved.').then(() => setAmt((a) => ({ ...a, [g.id]: '' })))}>Add to savings</Button>
              {g.funded && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => call('saveToGetClaim', { goal_id: g.id }, 'Claimed.')}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Claim it</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => call('saveToGetCancel', { goal_id: g.id }, 'Canceled.')}><X className="w-3.5 h-3.5 mr-1" />Cancel &amp; refund</Button>
            </div>
          )}
          <p className="text-[11px] text-gray-400">{g.message}</p>
        </CardContent></Card>
      ))}

      {data.disclosures && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How Save-to-Get works</p>
          <ul className="space-y-1.5">{data.disclosures.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>)}</ul>
        </div>
      )}
      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
