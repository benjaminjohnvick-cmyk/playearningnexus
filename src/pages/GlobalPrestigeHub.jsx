import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Star, Zap, Trophy, Globe, ShoppingCart, Users, Flame, Loader2, RefreshCw, Lock, Unlock } from 'lucide-react';
import MilestoneAchievements from '@/components/achievements/MilestoneAchievements';
import { toast } from 'sonner';

const TIER_CONFIG = {
  bronze:   { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300', gradient: 'from-orange-400 to-amber-500', next: 200 },
  silver:   { color: 'text-slate-600',  bg: 'bg-slate-100',  border: 'border-slate-300',  gradient: 'from-slate-400 to-slate-500', next: 400 },
  gold:     { color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-400', gradient: 'from-yellow-400 to-yellow-600', next: 600 },
  platinum: { color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-400', gradient: 'from-purple-500 to-indigo-600', next: 800 },
  diamond:  { color: 'text-cyan-700',   bg: 'bg-cyan-100',   border: 'border-cyan-400',   gradient: 'from-cyan-400 to-blue-600',   next: 1000 },
};

const POOLS = [
  { id: 'silver_pool',   label: '🥈 Silver Pool',   min: 200, desc: 'Higher-paying surveys, +10% bonus',  fee_disc: 3 },
  { id: 'gold_pool',     label: '🥇 Gold Pool',     min: 400, desc: 'Premium surveys, priority matching', fee_disc: 6 },
  { id: 'platinum_pool', label: '💜 Platinum Pool', min: 600, desc: 'Exclusive corporate surveys',        fee_disc: 10 },
  { id: 'diamond_pool',  label: '💎 Diamond Pool',  min: 800, desc: 'Elite brand partnerships, VIP perks',fee_disc: 15 },
];

function TierBadge({ tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border-2 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Star className="w-3.5 h-3.5" />
      {tier?.charAt(0).toUpperCase() + tier?.slice(1)}
    </span>
  );
}

export default function GlobalPrestigeHub() {
  const [user, setUser] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: prestige, isLoading, refetch } = useQuery({
    queryKey: ['global_prestige', user?.id],
    queryFn: () => base44.entities.GlobalPrestige.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user?.id,
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await base44.functions.invoke('calculateGlobalPrestige', { user_id: user.id });
      await refetch();
      toast.success('Prestige score updated!');
    } catch (e) {
      toast.error('Failed to recalculate: ' + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  if (!user || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  }

  const score = prestige?.prestige_score || 0;
  const tier = prestige?.prestige_tier || 'bronze';
  const cfg = TIER_CONFIG[tier];
  const nextThreshold = cfg.next;
  const progressPct = Math.min(100, (score / nextThreshold) * 100);

  const radarData = [
    { subject: 'Surveys', value: Math.min(100, (prestige?.survey_score || 0) / 3), fullMark: 100 },
    { subject: 'Games', value: Math.min(100, (prestige?.gameplay_score || 0) / 2), fullMark: 100 },
    { subject: 'Marketplace', value: Math.min(100, (prestige?.marketplace_score || 0) / 2), fullMark: 100 },
    { subject: 'Referrals', value: Math.min(100, (prestige?.referral_score || 0) / 2), fullMark: 100 },
    { subject: 'Streaks', value: Math.min(100, (prestige?.streak_score || 0)), fullMark: 100 },
  ];

  const unlockedPools = prestige?.unlocked_survey_pools || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-6">
          <div className={`inline-flex items-center gap-3 bg-gradient-to-r ${cfg.gradient} text-white px-6 py-3 rounded-2xl shadow-2xl mb-4`}>
            <Star className="w-6 h-6" />
            <span className="text-xl font-black">Global Prestige</span>
            <Star className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-black text-white mb-1">{score} <span className="text-2xl font-normal text-purple-300">/ 1000</span></h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <TierBadge tier={tier} />
            {prestige?.fee_discount_pct > 0 && (
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                -{prestige.fee_discount_pct}% platform fees
              </Badge>
            )}
          </div>
          <Progress value={progressPct} className="mt-4 max-w-sm mx-auto h-3 bg-white/10" />
          <p className="text-purple-300 text-sm mt-2">{score} / {nextThreshold} to next tier</p>
          <Button onClick={handleRecalculate} disabled={recalculating} variant="ghost" size="sm" className="mt-2 text-purple-300 hover:text-white">
            {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Recalculate
          </Button>
        </div>

        {/* Score breakdown + radar */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-200">Score Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Surveys', icon: Zap, score: prestige?.survey_score || 0, max: 300, sub: `${prestige?.total_surveys_completed || 0} completed` },
                { label: 'Game Play', icon: Trophy, score: prestige?.gameplay_score || 0, max: 200, sub: `${prestige?.total_game_minutes || 0} minutes` },
                { label: 'Marketplace', icon: ShoppingCart, score: prestige?.marketplace_score || 0, max: 200, sub: `$${(prestige?.total_marketplace_spend || 0).toFixed(2)} spent` },
                { label: 'Referrals', icon: Users, score: prestige?.referral_score || 0, max: 200, sub: `${prestige?.total_referrals || 0} referrals` },
                { label: 'Daily Streaks', icon: Flame, score: prestige?.streak_score || 0, max: 100, sub: `${prestige?.current_streak_days || 0}-day streak` },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-sm"><Icon className="w-3.5 h-3.5 text-purple-300" />{s.label}</span>
                      <span className="text-sm font-bold">{s.score} <span className="text-white/40">/ {s.max}</span></span>
                    </div>
                    <Progress value={(s.score / s.max) * 100} className="h-1.5 bg-white/10" />
                    <p className="text-xs text-white/40 mt-0.5">{s.sub}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-200">Engagement Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.15)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                  <Radar dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
                  <Tooltip contentStyle={{ background: '#1e1b4b', border: 'none', color: 'white' }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {prestige?.ai_insights && (
          <Card className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-purple-500/30 text-white">
            <CardContent className="pt-4 flex items-start gap-3">
              <Globe className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-100">{prestige.ai_insights}</p>
            </CardContent>
          </Card>
        )}

        {/* Milestone Badges */}
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-200">🏅 Your Achievements</CardTitle></CardHeader>
          <CardContent>
            <MilestoneAchievements userId={user?.id} stats={{ surveysCompleted: prestige?.total_surveys_completed || 0, totalEarnings: user?.total_earnings || 0, streakDays: prestige?.current_streak_days || 0, activeReferrals: prestige?.total_referrals || 0, totalReferrals: prestige?.total_referrals || 0, memberDays: user?.created_date ? Math.floor((Date.now() - new Date(user.created_date)) / 86400000) : 0, avgQuality: 0, highQualityCompletions: 0, fastCompletions: 0, prestigeScore: prestige?.prestige_score || 0 }} compact />
          </CardContent>
        </Card>

        {/* Exclusive Survey Pools */}
        <div>
          <h3 className="text-white font-bold mb-3">🔒 Exclusive Survey Pools</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {POOLS.map(pool => {
              const unlocked = unlockedPools.includes(pool.id);
              return (
                <Card key={pool.id} className={`border ${unlocked ? 'bg-white/10 border-white/20' : 'bg-white/3 border-white/10 opacity-60'} text-white`}>
                  <CardContent className="pt-4 flex items-start gap-3">
                    {unlocked ? <Unlock className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Lock className="w-5 h-5 text-white/30 flex-shrink-0" />}
                    <div>
                      <p className="font-bold">{pool.label}</p>
                      <p className="text-xs text-white/60 mt-0.5">{pool.desc}</p>
                      <p className="text-xs text-green-400 mt-1">-{pool.fee_disc}% fees · Requires {pool.min}+ prestige</p>
                      {!unlocked && <p className="text-xs text-white/30 mt-1">Need {Math.max(0, pool.min - score)} more prestige points</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}