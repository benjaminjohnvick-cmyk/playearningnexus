import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Trophy, Zap, Gift, CheckCircle, Lock, TrendingUp, Award } from 'lucide-react';
import { toast } from 'sonner';

const MILESTONES = [
  { id: 'first_completion',   label: 'First Completion',    points: 50,   icon: '🎯', desc: 'Complete your first survey',              check: (ads) => ads.some(a => (a.surveys_completed||0) >= 1) },
  { id: 'completions_100',    label: '100 Completions',     points: 200,  icon: '💯', desc: 'Reach 100 total survey completions',      check: (ads) => ads.reduce((s,a)=>s+(a.surveys_completed||0),0) >= 100 },
  { id: 'completions_500',    label: '500 Completions',     points: 500,  icon: '🚀', desc: 'Reach 500 total survey completions',      check: (ads) => ads.reduce((s,a)=>s+(a.surveys_completed||0),0) >= 500 },
  { id: 'completions_1000',   label: '1000 Completions',    points: 1000, icon: '👑', desc: 'Reach 1,000 total survey completions',    check: (ads) => ads.reduce((s,a)=>s+(a.surveys_completed||0),0) >= 1000 },
  { id: 'high_ctr',           label: 'High Performer',      points: 300,  icon: '⚡', desc: 'Maintain 5%+ CTR on any active ad',       check: (ads) => ads.some(a => (a.total_clicks||0) >= 20 && (a.surveys_completed/(a.total_clicks||1)*100) >= 5) },
  { id: 'multi_ad',           label: 'Multi-Campaign',      points: 150,  icon: '📊', desc: 'Run 3 or more ads simultaneously',        check: (ads) => ads.filter(a=>a.status==='active').length >= 3 },
  { id: 'big_spender',        label: 'Big Spender',         points: 400,  icon: '💰', desc: 'Spend over $50 total on campaigns',       check: (ads) => ads.reduce((s,a)=>s+(a.total_spent||0),0) >= 50 },
  { id: 'premium_tier',       label: 'Premium Advertiser',  points: 600,  icon: '🌟', desc: 'Place an ad in the Premium grid tier',    check: (ads) => ads.some(a => a.grid_tier === 'Premium') },
];

const REWARDS = [
  { id: 'discount_10',  label: '10% Bid Discount',       cost: 500,  icon: <Zap className="w-4 h-4 text-yellow-400" />,    desc: 'Reduce your next bid by 10%' },
  { id: 'featured_24h', label: 'Featured Spot (24h)',    cost: 1200, icon: <Star className="w-4 h-4 text-purple-400" />,   desc: 'Pin your ad to top of the grid for 24 hours' },
  { id: 'bonus_budget', label: '$5 Bonus Budget',        cost: 800,  icon: <Gift className="w-4 h-4 text-green-400" />,    desc: 'Add $5 free to your ad balance' },
  { id: 'analytics_pro',label: 'Analytics Pro (7 days)', cost: 600,  icon: <TrendingUp className="w-4 h-4 text-blue-400" />, desc: 'Unlock advanced demographic reports' },
];

function getLevel(points) {
  if (points >= 2500) return { name: 'Diamond', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', next: null };
  if (points >= 1500) return { name: 'Gold',    color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', next: 2500 };
  if (points >= 700)  return { name: 'Silver',  color: 'text-gray-300', bg: 'bg-gray-500/10 border-gray-500/30', next: 1500 };
  return { name: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', next: 700 };
}

export default function AdLoyaltySystem({ ads, userId }) {
  const [redeemed, setRedeemed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`gg_redeemed_${userId}`) || '[]'); } catch { return []; }
  });
  const [claimed, setClaimed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`gg_claimed_${userId}`) || '[]'); } catch { return []; }
  });

  const unlockedMilestones = useMemo(() => MILESTONES.filter(m => m.check(ads)), [ads]);
  const totalPoints = useMemo(() =>
    unlockedMilestones.filter(m => claimed.includes(m.id)).reduce((s, m) => s + m.points, 0)
  , [claimed, unlockedMilestones]);

  const spendablePoints = totalPoints - REWARDS.filter(r => redeemed.includes(r.id)).reduce((s,r)=>s+r.cost,0);
  const level = getLevel(totalPoints);

  const claimMilestone = (id, points) => {
    const next = [...claimed, id];
    setClaimed(next);
    localStorage.setItem(`gg_claimed_${userId}`, JSON.stringify(next));
    toast.success(`+${points} GamerGain Points earned! 🎉`);
  };

  const redeemReward = async (reward) => {
    if (spendablePoints < reward.cost) { toast.error('Not enough points'); return; }
    const next = [...redeemed, reward.id];
    setRedeemed(next);
    localStorage.setItem(`gg_redeemed_${userId}`, JSON.stringify(next));
    if (reward.id === 'bonus_budget') {
      const me = await base44.auth.me();
      await base44.auth.updateMe({ ad_balance: (me.ad_balance || 0) + 5 });
    }
    toast.success(`Redeemed: ${reward.label}! Check your dashboard.`);
  };

  return (
    <div className="space-y-6">
      {/* Level card */}
      <div className={`border rounded-2xl p-5 ${level.bg}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Advertiser Level</p>
            <p className={`text-3xl font-black ${level.color}`}>{level.name}</p>
            <p className="text-gray-500 text-xs mt-1">{totalPoints.toLocaleString()} GamerGain Points earned</p>
          </div>
          <div className="text-right">
            <p className="text-white font-black text-2xl">{spendablePoints.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">points available</p>
            {level.next && (
              <p className="text-gray-600 text-[11px] mt-1">{(level.next - totalPoints).toLocaleString()} pts to {level.name === 'Bronze' ? 'Silver' : level.name === 'Silver' ? 'Gold' : 'Diamond'}</p>
            )}
          </div>
        </div>
        {level.next && (
          <div className="mt-4">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalPoints / level.next) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" /> Milestones
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MILESTONES.map(m => {
            const unlocked = unlockedMilestones.some(u => u.id === m.id);
            const isClaimed = claimed.includes(m.id);
            return (
              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isClaimed ? 'bg-green-500/5 border-green-500/20' :
                unlocked ? 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-gray-800/40 border-gray-700/50 opacity-60'
              }`}>
                <span className="text-xl flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold">{m.label}</p>
                  <p className="text-gray-500 text-[11px]">{m.desc}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-yellow-400 text-xs font-black">+{m.points}</span>
                  {isClaimed ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : unlocked ? (
                    <Button size="sm" onClick={() => claimMilestone(m.id, m.points)}
                      className="bg-yellow-500 text-black font-black text-[10px] h-6 px-2">Claim</Button>
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rewards */}
      <div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple-400" /> Redeem Points
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REWARDS.map(r => {
            const isRedeemed = redeemed.includes(r.id);
            const canAfford = spendablePoints >= r.cost;
            return (
              <div key={r.id} className={`p-4 rounded-xl border flex items-start gap-3 ${
                isRedeemed ? 'bg-gray-800/30 border-gray-700/30 opacity-50' : 'bg-gray-800/60 border-gray-700'
              }`}>
                <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{r.label}</p>
                  <p className="text-gray-500 text-[11px]">{r.desc}</p>
                  <p className="text-yellow-400 text-xs font-black mt-1">{r.cost.toLocaleString()} pts</p>
                </div>
                {isRedeemed ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">Redeemed</Badge>
                ) : (
                  <Button size="sm" onClick={() => redeemReward(r)} disabled={!canAfford}
                    className={`text-xs h-7 font-bold ${canAfford ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                    Redeem
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}