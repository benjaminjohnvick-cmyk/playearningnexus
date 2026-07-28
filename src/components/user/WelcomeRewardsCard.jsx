import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// WelcomeRewardsCard — surfaces the promotional value site-wide: the advertised "up to $X in value"
// figure, the user's remaining welcome-rewards credit, and a Daily Boost claim (5 min free app time
// after earning $4 today). Uses welcomeCreditStatus / dailyBoostStatus / claimDailyBoost.
export default function WelcomeRewardsCard() {
  const [welcome, setWelcome] = useState(null);
  const [boost, setBoost] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const loadBoost = useCallback(() => {
    base44.functions.invoke('dailyBoostStatus', {}).then((r) => setBoost(r.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    base44.functions.invoke('welcomeCreditStatus', {}).then((r) => setWelcome(r.data || null)).catch(() => {});
    loadBoost();
  }, [loadBoost]);

  async function claimBoost() {
    setClaiming(true);
    try {
      const r = await base44.functions.invoke('claimDailyBoost', {});
      if (r.data?.success) { toast.success(`Daily Boost! Your next ${r.data.minutes} min are on us.`); loadBoost(); }
      else toast.error(r.data?.error || 'Not ready yet');
    } catch (e) { toast.error(e?.data?.error || e.message || 'Could not claim'); }
    finally { setClaiming(false); }
  }

  if (!welcome && !boost) return null;
  const remaining = Number(welcome?.remaining_usd) || 0;
  const advertised = Number(welcome?.advertised_value_usd) || 0;
  const windowActive = boost?.free_window_active;
  const earned = Number(boost?.earned_today_usd) || 0;
  const threshold = Number(boost?.threshold_usd) || 4;
  const pct = threshold > 0 ? Math.min(100, Math.round((earned / threshold) * 100)) : 0;

  return (
    <Card className="mb-4 border-red-200 overflow-hidden">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-red-600" />
          </div>
          <div>
            {advertised > 0 && <div className="font-semibold text-sm">Up to ${advertised.toLocaleString()} in first-year value</div>}
            {remaining > 0 && !welcome?.expired && (
              <div className="text-xs text-zinc-500">
                You have <b>${remaining.toLocaleString()}</b> in welcome rewards to spend
                {welcome?.max_pct ? ` (covers up to ${Math.round(welcome.max_pct * 100)}% per order)` : ''}.
              </div>
            )}
            <div className="text-[11px] text-zinc-400">Non-cashable promotional credit; expires 12 months after signup. Terms apply.</div>
          </div>
        </div>

        {boost && (
          <div className="flex items-center gap-3 md:border-l md:pl-4">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${windowActive ? 'text-green-500' : 'text-amber-500'}`} />
              <div className="text-xs">
                <div className="font-medium">Daily Boost — {boost.minutes || 5} min free app time</div>
                {windowActive ? (
                  <div className="text-green-600">Active now — in-app purchases are free.</div>
                ) : boost.claimed_today ? (
                  <div className="text-zinc-400">Claimed today. Come back tomorrow.</div>
                ) : (
                  <div className="text-zinc-500">Earn ${threshold} in offers to unlock (${earned.toFixed(2)} / ${threshold} · {pct}%)</div>
                )}
              </div>
            </div>
            {!windowActive && !boost.claimed_today && (
              <Button size="sm" disabled={claiming || !boost.unlocked} onClick={claimBoost}>
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : (boost.unlocked ? 'Claim' : 'Locked')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
