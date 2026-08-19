import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, PiggyBank, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

// EarningsSetAsideButton — a clearly-labeled, self-explaining control for the Tier 1 / Tier 2 offer pages.
// Lets the user CHOOSE what share of their OWN earnings (closed-loop Site Cash) to set aside for later.
// Off by default, fully reversible, nothing owed. Drop <EarningsSetAsideButton /> onto any page.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';
const PRESETS = [0, 10, 25, 50];

export default function EarningsSetAsideButton() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [moveAmt, setMoveAmt] = useState('');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('earningsSetAsideStatus', {});
      setData(res || null);
    } catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load();   }, []);

  const call = async (fn, payload, okText) => {
    setBusy(true); setMsg(null);
    try {
      const res = await base44.functions.invoke(fn, payload);
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: res?.note || okText }); await load(); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading || !data?.enabled) return null;
  const s = data.status;
  const curPct = Math.round((s.pct || 0) * 100);

  return (
    <Card className="border" style={{ borderColor: '#e5e7eb' }}>
      {/* The button itself — label + one-line explanation always visible */}
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <CardContent className="p-4 flex items-start gap-3">
          <PiggyBank className="w-5 h-5 mt-0.5 shrink-0" style={{ color: NAVY }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">Set aside part of my earnings</span>
              {curPct > 0
                ? <Badge style={{ background: GOLD, color: INK }}>{curPct}% set aside</Badge>
                : <Badge variant="outline" className="border-gray-300 text-gray-500">off</Badge>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Optional — you choose how much of what you earn to save for later. It stays your own Site Cash,
              spend it on your ad plan or anything else, and move it back anytime. Nothing is owed.
            </p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
        </CardContent>
      </button>

      {open && (
        <CardContent className="pt-0 px-4 pb-4 space-y-4">
          {/* Balances */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-lg font-bold" style={{ color: INK }}>{money(s.setaside_balance_usd)}</p>
              <p className="text-[11px] text-gray-500">set aside</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-lg font-bold" style={{ color: INK }}>{money(s.spendable_usd)}</p>
              <p className="text-[11px] text-gray-500">spendable</p>
            </div>
          </div>

          {/* Choose the percentage of FUTURE earnings to set aside */}
          <div>
            <span className="text-xs font-semibold text-gray-700">How much of new earnings to set aside</span>
            <div className="flex gap-1.5 mt-1 flex-wrap items-center">
              {PRESETS.map((p) => (
                <button key={p} disabled={busy} onClick={() => call('earningsSetAsideSetPct', { pct: p }, 'Updated.')}
                  className={`px-3 py-1.5 rounded-full text-sm border ${curPct === p ? 'text-white border-transparent' : 'border-gray-300 text-gray-600'}`}
                  style={curPct === p ? { background: NAVY } : undefined}>
                  {p === 0 ? 'Off' : `${p}%`}
                </button>
              ))}
              <span className="text-[11px] text-gray-400">up to {Math.round((data.max_pct || 1) * 100)}%</span>
            </div>
          </div>

          {/* Move a specific amount now / release it back — proves nothing is locked */}
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label htmlFor="setaside-move-amount" className="text-[11px] text-gray-500">Move an amount now</label>
              <div className="flex items-center gap-1"><span className="text-gray-400">$</span>
                <Input id="setaside-move-amount" type="number" min="0" value={moveAmt} onChange={(e) => setMoveAmt(e.target.value)} className="w-24 h-9" placeholder="0" />
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={busy || !(Number(moveAmt) > 0)}
              onClick={() => call('earningsSetAsideMoveNow', { amount_usd: Number(moveAmt) }, 'Moved.').then(() => setMoveAmt(''))}>
              → Set aside
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || !(s.setaside_balance_usd > 0)}
              onClick={() => call('earningsSetAsideRelease', { all: true }, 'Released.')}>
              Move all back to spendable
            </Button>
          </div>

          {/* Self-explaining disclosures */}
          {data.disclosures && (
            <ul className="space-y-1 pt-1 border-t">
              {data.disclosures.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-gray-500"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{d}</li>
              ))}
            </ul>
          )}

          {busy && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />working…</div>}
          {msg && <div className={`text-xs rounded-lg p-2.5 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
        </CardContent>
      )}
    </Card>
  );
}
