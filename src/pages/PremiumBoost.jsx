import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, ShieldCheck, Crown, ShoppingBag } from 'lucide-react';

// PremiumBoost — advertiser-funded gift boost for premium members. Up to $2,000 of NON-CASHABLE store credit,
// funded by advertiser fees. The member chooses how much to claim and which items to apply it to. No debt,
// nothing owed, value flows advertiser/platform → member only.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function PremiumBoost() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [claimAmt, setClaimAmt] = useState('');
  const [item, setItem] = useState(''); const [itemPrice, setItemPrice] = useState(''); const [applyAmt, setApplyAmt] = useState('');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try { const r = await base44.functions.invoke('premiumBoostStatus', {}); setData(r || null); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const call = async (fn, payload, ok, after) => {
    setBusy(true); setMsg(null);
    try { const r = await base44.functions.invoke(fn, payload); if (r?.error) setMsg({ type: 'error', text: r.error }); else { setMsg({ type: 'ok', text: r?.note || ok }); after && after(); await load(); } }
    catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data?.enabled) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">The premium boost is unavailable.</div>;
  const s = data.status;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Sparkles className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Advertiser-Funded Boost</h1>
        <Badge style={{ background: GOLD, color: INK }}>up to {money(s.max_usd)} · premium</Badge>
        {s.premium && <Badge variant="outline" className="border-amber-400 text-amber-700"><Crown className="w-3 h-3 mr-1" />premium</Badge>}
      </div>
      <p className="text-sm text-gray-600">A gift boost for premium members — up to {money(s.max_usd)} in store credit, <strong>funded by our advertisers</strong>, not by you or anyone else. Claim what you want and spend it on the items you choose. It's non-cashable store credit; nothing is owed.</p>

      {/* Boost balances */}
      <Card><CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{money(s.available_credit_usd)}</p><p className="text-[11px] text-gray-500">boost credit to spend</p></div>
          <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{money(s.granted_usd)}</p><p className="text-[11px] text-gray-500">claimed of {money(s.max_usd)}</p></div>
          <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{money(s.used_usd)}</p><p className="text-[11px] text-gray-500">used on items</p></div>
        </div>
        <Progress value={Math.min(100, (s.granted_usd / (s.max_usd || 1)) * 100)} className="h-2.5" />
      </CardContent></Card>

      {/* Claim */}
      <Card><CardContent className="p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Claim your boost</h3>
        {s.eligible ? (
          <>
            <p className="text-sm text-gray-600">You can claim up to {money(s.claimable_now_usd)} more right now (advertiser pool: {money(s.pool_available_usd)} available). Choose how much:</p>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" max={s.claimable_now_usd} value={claimAmt} onChange={(e) => setClaimAmt(e.target.value)} placeholder={String(s.claimable_now_usd)} className="w-28" /></div>
              <Button disabled={busy} className="bg-[#16264f] hover:bg-[#0a142e]" onClick={() => call('premiumBoostClaim', { amount_usd: claimAmt === '' ? undefined : Number(claimAmt) }, 'Claimed.', () => setClaimAmt(''))}>Claim{claimAmt ? ` ${money(Number(claimAmt))}` : ' full amount'}</Button>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">{s.reason || 'No boost to claim right now.'}</p>}
      </CardContent></Card>

      {/* Apply to an item */}
      {s.available_credit_usd > 0 && (
        <Card><CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><ShoppingBag className="w-4 h-4" style={{ color: NAVY }} />Use it on an item</h3>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input placeholder="Item name" value={item} onChange={(e) => setItem(e.target.value)} className="sm:col-span-2" />
            <div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" placeholder="Item price" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} /></div>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div><label className="text-[11px] text-gray-500">How much boost to apply</label><div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" max={s.available_credit_usd} value={applyAmt} onChange={(e) => setApplyAmt(e.target.value)} className="w-28" /></div></div>
            <Button disabled={busy || !item || !(Number(applyAmt) > 0)} className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => call('premiumBoostApply', { item_name: item, item_price_usd: itemPrice === '' ? undefined : Number(itemPrice), amount_usd: Number(applyAmt) }, 'Applied.', () => { setItem(''); setItemPrice(''); setApplyAmt(''); })}>Apply to item</Button>
          </div>
          <p className="text-[11px] text-gray-400">Pick any item and how much of your boost to put toward it. Whatever you don't use stays as credit for next time.</p>
        </CardContent></Card>
      )}

      {data.disclosures && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How the boost works</p>
          <ul className="space-y-1.5">{data.disclosures.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>)}</ul>
        </div>
      )}
      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
