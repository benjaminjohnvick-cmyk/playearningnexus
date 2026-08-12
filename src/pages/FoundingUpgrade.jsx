import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, ArrowUpRight, CheckCircle2, Circle, Info } from 'lucide-react';

// FoundingUpgrade — the founding advertiser's credit picture: the $1,000 conditional sign-up credit, the
// $12,000 rollover credit, and the upgrade quote (net price after credit). All credit is non-cashable Site
// Cash; nothing is ever owed. Read-only — the page prices the upgrade, it does not charge.
const money = (n) => `$${Number(n || 0).toLocaleString()}`;
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

function Cond({ ok, children }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />}
      <span className={ok ? 'text-gray-700' : 'text-gray-500'}>{children}</span>
    </li>
  );
}

export default function FoundingUpgrade() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('foundingRolloverStatus', {});
        setData(res || null);
      } catch (e) {
        setErr(e?.message || 'Could not load your founding credits.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (err) return <div className="max-w-xl mx-auto py-24 text-center text-red-600">{err}</div>;

  const roll = data?.rollover;
  const quote = data?.upgrade_quote;
  const signup = data?.signup_credit;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Gift className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>Founding Advertiser — Credits & Upgrade</h1>
      </div>

      {!data?.has_founding_seat && (
        <Card><CardContent className="p-5">
          <div className="flex items-start gap-3"><Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <p className="text-sm text-gray-600">These credits apply once you hold a founding Tier 1 seat.</p>
          </div>
        </CardContent></Card>
      )}

      {/* Sign-up credit */}
      {signup && (
        <Card><CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Sign-up credit</h3>
            <Badge style={{ background: GOLD, color: INK }}>{money(signup.credit_usd)} over {signup.window_months} mo</Badge>
          </div>
          <div className="flex items-end gap-4">
            <div><p className="text-2xl font-extrabold" style={{ color: INK }}>{money(signup.vested_usd)}</p><p className="text-xs text-gray-500">available now</p></div>
            <div><p className="text-lg font-semibold text-gray-400">{money(signup.remaining_usd)}</p><p className="text-xs text-gray-500">still to vest</p></div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">To unlock</p>
            <ul className="space-y-1">
              <Cond ok={signup.conditions?.feedback?.met}>Give feedback{signup.conditions?.feedback?.required ? '' : ' (optional)'}</Cond>
              <Cond ok={signup.conditions?.referrals?.met}>Refer {signup.conditions?.referrals?.required} active user{signup.conditions?.referrals?.required === 1 ? '' : 's'} ({signup.conditions?.referrals?.have || 0} so far)</Cond>
              <Cond ok={signup.conditions?.months_active?.met}>Use the app {signup.conditions?.months_active?.required} months ({signup.conditions?.months_active?.have || 0} active so far)</Cond>
            </ul>
          </div>
          <p className="text-xs text-gray-400">{signup.note}</p>
        </CardContent></Card>
      )}

      {/* Rollover credit + upgrade quote */}
      {roll && quote && (
        <Card><CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" style={{ color: NAVY }} />Roll into the upgrade</h3>
            <Badge variant="outline" className={roll.within_window ? 'border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-500'}>
              {roll.within_window ? 'window open' : 'window closed'}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">Rollover credit available: <strong>{money(roll.remaining_credit_usd)}</strong> of {money(roll.credit_usd)}</p>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm"><span className="text-gray-600">{quote.upgrade_name}</span><span className="tabular-nums">{money(quote.upgrade_price_usd)}</span></div>
            <div className="flex items-center justify-between text-sm text-emerald-700"><span>Credit applied</span><span className="tabular-nums">− {money(quote.credit_applied_usd)}</span></div>
            <div className="border-t mt-2 pt-2 flex items-center justify-between font-bold" style={{ color: INK }}><span>Net price</span><span className="tabular-nums">{money(quote.net_price_usd)}</span></div>
          </div>
          <p className="text-xs text-gray-400">{quote.note}</p>
        </CardContent></Card>
      )}

      {Array.isArray(data?.disclosures) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Please read</p>
          <ul className="space-y-1.5">
            {data.disclosures.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
