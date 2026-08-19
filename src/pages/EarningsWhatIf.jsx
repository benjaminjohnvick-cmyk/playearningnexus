import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, Info } from 'lucide-react';

// EarningsWhatIf — a user-driven "what-if" calculator. YOU enter the assumptions; the scenario is computed
// only from your own history and the site rate, and is clearly NOT a prediction or promise. This is the
// compliant, user-controlled stand-in for platform earnings projections.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function EarningsWhatIf() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mins, setMins] = useState(''); const [days, setDays] = useState('30'); const [target, setTarget] = useState('');
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await base44.functions.invoke('earningsWhatIf', {
        minutes_per_day: mins === '' ? undefined : Number(mins),
        days: days === '' ? undefined : Number(days),
        target_usd: target === '' ? undefined : Number(target),
      });
      if (r?.enabled === false) { setEnabled(false); return; }
      if (r?.error) setMsg({ type: 'error', text: r.error }); else setRes(r?.result ?? null);
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Could not calculate.' }); }
    finally { setBusy(false); setLoading(false); }
  };
  useEffect(() => { run();   }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!enabled) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">The what-if calculator is unavailable.</div>;

  const b = res?.based_on, sc = res?.scenario;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Calculator className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Your Earnings What-If</h1>
        <Badge style={{ background: GOLD, color: INK }}>your scenario, not a promise</Badge>
      </div>
      <p className="text-sm text-gray-600">Enter your own assumptions. We do the math using <strong>your</strong> actual history and the site's rate. This is a personal what-if — not a prediction or a guarantee of what you'll earn.</p>

      <Card><CardContent className="p-5 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Minutes/day (optional)</label><Input type="number" min="0" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="your recent pace" /></div>
          <div><label className="text-xs text-gray-500">Over how many days</label><Input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Target (optional)</label><div className="flex items-center gap-1"><span className="text-gray-400">$</span><Input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" /></div></div>
        </div>
        <Button onClick={run} disabled={busy} className="bg-[#16264f] hover:bg-[#0a142e]">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate my scenario'}</Button>
      </CardContent></Card>

      {res && (
        <Card><CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{money(sc.daily_usd)}</p><p className="text-[11px] text-gray-500">scenario/day</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{sc.total_over_days != null ? money(sc.total_over_days) : '—'}</p><p className="text-[11px] text-gray-500">over {res.assumptions.days ?? '—'} days</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold" style={{ color: INK }}>{sc.days_to_target != null ? `${sc.days_to_target}d` : '—'}</p><p className="text-[11px] text-gray-500">to {res.assumptions.target_usd != null ? money(res.assumptions.target_usd) : 'target'}</p></div>
          </div>
          <div className="text-xs text-gray-500 border-t pt-2">
            Based on your own numbers: recent average {money(b.your_recent_daily_usd)}/day over {b.your_active_days} active days · site rate {money(b.site_rate_per_min_usd)}/min · daily cap {money(b.daily_cap_usd)}.
          </div>
          <p className="text-[11px] text-gray-400 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />{res.disclaimer}</p>
        </CardContent></Card>
      )}
      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
