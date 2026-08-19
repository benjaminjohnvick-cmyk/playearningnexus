import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, ShieldCheck } from 'lucide-react';

// GiftBoost — send a PLATFORM-funded, non-cashable boost to someone. The value comes from the platform, not
// your wallet, so nothing moves user-to-user (no money transmission). Compliant stand-in for P2P transfers.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function GiftBoost() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState(''); const [amt, setAmt] = useState(''); const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try { const r = await base44.functions.invoke('giftBoostStatus', {}); setData(r || null); if (r?.config && !amt) setAmt(String(r.config.max_usd || '')); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load();   }, []);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await base44.functions.invoke('giftBoostSend', { to, amount_usd: Number(amt), message: note });
      if (r?.error) setMsg({ type: 'error', text: r.error });
      else { setMsg({ type: 'ok', text: r?.note || 'Sent.' }); setTo(''); setNote(''); await load(); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data?.enabled) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">Gift/boost is unavailable.</div>;
  const c = data.config;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Gift className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Send a Boost</h1>
        <Badge style={{ background: GOLD, color: INK }}>platform-funded · {c.remaining_today} left today</Badge>
      </div>
      <p className="text-sm text-gray-600">Send someone a little boost. It's funded by the platform as a thank-you — <strong>not</strong> money from your balance — so nothing moves from your wallet to theirs.</p>

      <Card><CardContent className="p-5 space-y-3">
        <div><label className="text-xs text-gray-500">Send to (referral code, email, or user id)</label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="their code / email" /></div>
        <div className="flex items-end gap-3 flex-wrap">
          <div><label className="text-xs text-gray-500">Amount (max {money(c.max_usd)})</label><div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" max={c.max_usd} value={amt} onChange={(e) => setAmt(e.target.value)} className="w-24" /></div></div>
          <div className="flex-1 min-w-[140px]"><label className="text-xs text-gray-500">Message (optional)</label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nice work!" /></div>
        </div>
        <Button onClick={send} disabled={busy || !to || !(Number(amt) > 0) || c.remaining_today <= 0} className="bg-[#16264f] hover:bg-[#0a142e]">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Send ${money(Number(amt) || 0)} boost`}
        </Button>
        {c.point_cost > 0 && <p className="text-[11px] text-gray-400">Costs you {c.point_cost.toLocaleString()} of your own points to send — your cost, never a transfer to them.</p>}
      </CardContent></Card>

      {(data.received?.length > 0 || data.sent?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs font-semibold text-gray-500 mb-1">Boosts you received</p>{(data.received || []).slice(0, 5).map((r, i) => <p key={i} className="text-sm text-emerald-700">+{money(r.amount_usd)}</p>)}{!data.received?.length && <p className="text-xs text-gray-400">none yet</p>}</CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs font-semibold text-gray-500 mb-1">Boosts you sent</p>{(data.sent || []).slice(0, 5).map((r, i) => <p key={i} className="text-sm text-gray-600">{money(r.amount_usd)}</p>)}{!data.sent?.length && <p className="text-xs text-gray-400">none yet</p>}</CardContent></Card>
        </div>
      )}

      {data.disclosures && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How boosts work</p>
          <ul className="space-y-1.5">{data.disclosures.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>)}</ul>
        </div>
      )}
      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
