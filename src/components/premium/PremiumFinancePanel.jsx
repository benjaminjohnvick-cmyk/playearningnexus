import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Crown, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * PremiumFinancePanel — get Premium with NO upfront charge. $1/day is deducted from earned Site Cash toward
 * the membership; the leftover comes back as Site Cash at month's end; earning too little downgrades to free
 * (no charge, no debt). Shows membership % paid, the Site Cash building up, and the monthly earning streak.
 *
 * Pay-as-you-earn from rewards — not a loan. Site Cash is closed-loop and non-withdrawable.
 */
export default function PremiumFinancePanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('premiumFinanceStatus', {});
      if (!res.data?.error) setStatus(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    setJoining(true);
    try {
      const res = await base44.functions.invoke('premiumFinanceStart', {});
      if (res.data?.error) toast.error(res.data.error);
      else { toast.success('Premium is on — no charge today. $1/day comes from your earnings.'); await load(); }
    } catch { toast.error('Could not start Premium.'); } finally { setJoining(false); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (!status?.enabled) return null;

  const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Enroll card — no plan yet and not already premium.
  if (!status.has_plan) {
    if (status.is_premium) return null;   // already premium some other way
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-800"><Crown className="w-4 h-4 text-amber-500" /> Get Premium — nothing to pay today</div>
          <p className="text-sm text-slate-600">
            We hold {money(status.daily_usd)}/day from your earnings toward your {money(status.price_usd)} membership.
            Finish the month and the leftover comes back to you as Site Cash. Earn too little to cover it and you
            just move to the free plan — no charge, no debt.
          </p>
          <Button size="sm" disabled={joining} onClick={join} className="w-full">
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Premium free today'}
          </Button>
          <div className="text-[11px] text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Site Cash spends only on this site — never withdrawable.</div>
        </CardContent>
      </Card>
    );
  }

  // Active plan — progress.
  return (
    <Card className="border-amber-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-800"><Crown className="w-4 h-4 text-amber-500" /> Premium — financed</div>
          <span className="text-[11px] text-slate-500">Day {status.cycle_day} of {status.cycle_days}</span>
        </div>

        {/* Membership paid */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-0.5">
            <span>Membership paid</span><span>{status.membership_paid_pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className={`h-2 rounded-full ${status.covered ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${status.membership_paid_pct}%` }} />
          </div>
        </div>

        {status.covered && status.excess_building_usd > 0 && (
          <div className="text-xs rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            Membership covered — {money(status.excess_building_usd)} is building up to come back as Site Cash at month&rsquo;s end.
          </div>
        )}

        {/* Monthly streak */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-0.5">
            <span>Successful-month streak</span>
            <span>{status.qualified ? 'On track ✓' : `${money(status.month_earnings_usd)} / ${money(status.success_target_usd)}`}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (status.month_earnings_usd / (status.success_target_usd || 1)) * 100)}%` }} />
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>{status.earning_days} earning days · {status.days_left} left this cycle</span>
          {!status.covered && <span className="text-amber-600">Keep earning to cover it</span>}
        </div>
      </CardContent>
    </Card>
  );
}
