import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, ShieldCheck, Wallet, Pause, Play, X } from 'lucide-react';
import EarningsSetAsideButton from '@/components/EarningsSetAsideButton';

// Tier1SelfPaced — the COMPLIANT pay-over-time option for Tier 1. Pay-as-you-go: the buyer chooses how much
// to pay and when, benefits accrue in proportion to what's actually paid, and NOTHING is ever owed. Not
// credit (no deferral, no balance, no recourse), so it's available with no lender/counsel gate.
const money = (n) => `$${Number(n || 0).toLocaleString()}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function Tier1SelfPaced() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('tier1SelfPacedStatus', {});
      setData(res || null);
      if (res?.config && !amount) setAmount(String(res.config.monthly_base_usd || ''));
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Could not load.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load();   }, []);

  const pay = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('tier1SelfPacedPay', { amount_usd: Number(amount) });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: res?.note || 'Recorded.' }); await load(); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  const doAction = async (action) => {
    setBusy(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('tier1SelfPacedCancel', { action });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: res?.note || 'Done.' }); await load(); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data?.enabled) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">Self-paced Tier 1 is unavailable.</div>;

  const s = data.status, c = data.config;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Wallet className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Tier 1 — Pay Your Own Way</h1>
        <Badge style={{ background: GOLD, color: INK }}>no debt · cancel anytime</Badge>
        {s.status === 'paused' && <Badge variant="outline" className="border-amber-400 text-amber-700">paused</Badge>}
        {s.status === 'canceled' && <Badge variant="outline" className="border-gray-300 text-gray-500">canceled</Badge>}
      </div>

      {/* You owe nothing — the headline reassurance */}
      <Card><CardContent className="p-5 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold" style={{ color: INK }}>{money(s.paid_to_date_usd)}</p>
            <p className="text-xs text-gray-500">paid so far · <span className="font-semibold text-emerald-700">{money(s.amount_owed_usd)} owed</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>{Number(s.impressions_delivered).toLocaleString()}</p>
            <p className="text-xs text-gray-500">of {Number(s.impressions_full_year).toLocaleString()} impressions</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress toward the full annual package (optional)</span><span>{s.progress_pct}%</span>
          </div>
          <Progress value={s.progress_pct} className="h-3" />
          <p className="text-[11px] text-gray-400 mt-1">{money(s.to_finish_annual_usd)} would complete the year — but you're never obligated to finish, and this is never a balance you owe.</p>
        </div>
        <p className="text-sm text-gray-700">{s.message}</p>
      </CardContent></Card>

      {/* Make a payment — buyer chooses the amount */}
      {s.status !== 'canceled' && (
        <Card><CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-gray-900">Pay what you want</h3>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label htmlFor="tier1-amount" className="text-xs text-gray-500">Amount (USD)</label>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">$</span>
                <Input id="tier1-amount" type="number" min={c.min_payment_usd} max={c.max_payment_usd || undefined} value={amount}
                  onChange={(e) => setAmount(e.target.value)} className="w-32" />
              </div>
            </div>
            <div className="flex gap-1.5">
              {[c.monthly_base_usd, c.monthly_base_usd * 3, c.annual_target_usd].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 hover:border-gray-400">{money(v)}</button>
              ))}
            </div>
            <Button onClick={pay} disabled={busy} className="bg-[#16264f] hover:bg-[#0a142e]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ${money(Number(amount) || 0)}`}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400">Suggested {money(c.monthly_base_usd)}/mo completes the year over {c.term_months} months — but pick any amount, any time. Min {money(c.min_payment_usd)}{c.max_payment_usd ? `, max ${money(c.max_payment_usd)}` : ''}.</p>
        </CardContent></Card>
      )}

      {/* Optional: set aside part of your earnings to help fund this (or anything) — your choice, nothing owed */}
      <EarningsSetAsideButton />

      {/* Pause / resume / cancel — all free, nothing owed */}
      <Card><CardContent className="p-4 flex items-center gap-2 flex-wrap">
        {c.allow_pause && s.status === 'active' && <Button variant="outline" size="sm" onClick={() => doAction('pause')} disabled={busy}><Pause className="w-3.5 h-3.5 mr-1" />Pause</Button>}
        {s.status === 'paused' && <Button variant="outline" size="sm" onClick={() => doAction('resume')} disabled={busy}><Play className="w-3.5 h-3.5 mr-1" />Resume</Button>}
        {s.status !== 'canceled' && <Button variant="outline" size="sm" onClick={() => doAction('cancel')} disabled={busy}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>}
        {s.status === 'canceled' && <Button variant="outline" size="sm" onClick={() => doAction('resume')} disabled={busy}><Play className="w-3.5 h-3.5 mr-1" />Restart</Button>}
        <span className="text-[11px] text-gray-400">Pausing or canceling costs nothing and leaves no balance.</span>
      </CardContent></Card>

      {/* Disclosures — every line says: nothing is owed */}
      {data.disclosures && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How this works</p>
          <ul className="space-y-1.5">
            {data.disclosures.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>)}
          </ul>
        </div>
      )}

      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
