import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, Lock, CheckCircle2, Clock, Crown } from 'lucide-react';

// Tier2Scaling — the Tier 2 "Scale" ladder: buy the $200k in 30-day parts, pay-as-you-go, scaling on results.
// 6% rollover discount (first year for all; perpetual for founding members). Each part is a separate purchase.
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function Tier2Scaling() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('tier2ScalingStatus', {});
      setStatus(res?.status ?? null);
      if (res?.error) setMsg({ type: 'error', text: res.error });
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Could not load Tier 2.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const buyPart = async () => {
    setBuying(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('tier2BuyPart', {});
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else setMsg({ type: 'ok', text: res?.note || `Part ${res.bought_part} recorded — ${money(res.amount_due_usd)} due at checkout.` });
      await load();
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBuying(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!status) return <div className="max-w-xl mx-auto py-24 text-center text-gray-500">Tier 2 is unavailable.</div>;

  const pct = Math.round((status.parts_completed / status.parts) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <TrendingUp className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>{status.name}</h1>
        <Badge style={{ background: GOLD, color: INK }}>{money(status.total_usd)} · {status.parts} parts</Badge>
        {status.is_founding && <Badge variant="outline" className="border-amber-400 text-amber-700"><Crown className="w-3 h-3 mr-1" />Founding</Badge>}
      </div>

      <Card><CardContent className="p-5 space-y-3">
        <div className="flex items-end justify-between">
          <div><p className="text-3xl font-extrabold" style={{ color: INK }}>{status.parts_completed}/{status.parts}</p><p className="text-xs text-gray-500">parts completed · {money(status.paid_usd)} in</p></div>
          <div className="text-right">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>{Math.round((status.discount_pct || 0) * 100)}% off</p>
            <p className="text-xs text-gray-500">{status.discount_perpetual ? 'founding — forever' : (status.discount_pct > 0 ? 'first-year rollover' : 'discount ended')}</p>
          </div>
        </div>
        <Progress value={pct} className="h-3" />
      </CardContent></Card>

      {/* Next part */}
      {!status.complete ? (
        <Card><CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Part {status.current_part_number} of {status.parts}</h3>
            {status.next_part_eligible
              ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">ready</Badge>
              : <Badge variant="outline" className="border-gray-300 text-gray-500">{status.days_until_next_part > 0 ? `${status.days_until_next_part}d` : 'locked'}</Badge>}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Part price</span><span className="tabular-nums">{money(status.current_part_base_usd)}</span></div>
            {status.discount_pct > 0 && <div className="flex items-center justify-between text-sm text-emerald-700"><span>Discount ({Math.round(status.discount_pct * 100)}%)</span><span className="tabular-nums">− {money((status.current_part_base_usd || 0) - (status.current_part_net_usd || 0))}</span></div>}
            <div className="border-t mt-2 pt-2 flex items-center justify-between font-bold" style={{ color: INK }}><span>Due at checkout</span><span className="tabular-nums">{money(status.current_part_net_usd)}</span></div>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            {status.next_part_eligible ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-gray-400" />}
            {status.reason}
          </p>
          <Button onClick={buyPart} disabled={buying || !status.next_part_eligible} className="bg-[#16264f] hover:bg-[#0a142e]">
            {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : `Buy part ${status.current_part_number}`}
          </Button>
          <p className="text-[11px] text-gray-400">Each part is a separate purchase — pay as you go. The next part unlocks after {status.part_min_days} days{status.results_gate_met ? '' : ' and once results catch up'}.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-gray-900">Tier 2 complete</p>
          <p className="text-sm text-gray-500">All {status.parts} parts purchased over the year.</p>
        </CardContent></Card>
      )}

      {/* Deliverables — what Tier 2 includes, scaled to parts bought */}
      {status.deliverables && (
        <Card><CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What Tier 2 includes</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-lg font-bold" style={{ color: INK }}>{Number(status.deliverables.impressions_delivered).toLocaleString()}</p>
              <p className="text-[11px] text-gray-500">of {Number(status.deliverables.impressions_per_year_full).toLocaleString()} impressions/yr</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-lg font-bold" style={{ color: INK }}>{status.deliverables.social_posts_active ? status.deliverables.social_posts_per_month : 0}</p>
              <p className="text-[11px] text-gray-500">AI social posts/mo</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-lg font-bold" style={{ color: INK }}>{status.deliverables.audience_panels_delivered}</p>
              <p className="text-[11px] text-gray-500">of {status.deliverables.audience_panels_per_year_full} audience panels/yr</p>
            </div>
          </div>
          <ul className="space-y-1">
            {(status.deliverables.perks_unlocked || []).map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{p.label}</li>
            ))}
            {(status.deliverables.perks_locked || []).map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-sm text-gray-400"><Lock className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />{p.label} <span className="text-[11px]">(unlocks at part {p.unlocks_at_part})</span></li>
            ))}
          </ul>
        </CardContent></Card>
      )}

      {/* Ladder */}
      <Card><CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">The scale-up ladder</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(status.ladder || []).map((p) => {
            const done = p.n <= status.parts_completed;
            const current = p.n === status.current_part_number;
            return (
              <div key={p.n} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${done ? 'bg-emerald-50' : current ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <span className="flex items-center gap-1.5 text-gray-700">{done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 text-gray-300" />}Part {p.n}</span>
                <span className="tabular-nums text-gray-500">{money(p.base_amount_usd)}</span>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}
