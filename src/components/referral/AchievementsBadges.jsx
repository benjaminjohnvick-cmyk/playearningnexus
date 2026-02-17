import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Award, 
  Star, 
  Trophy, 
  Zap, 
  Target, 
  TrendingUp,
  Users,
  Briefcase,
  Sparkles,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';

const ACHIEVEMENT_CONFIG = {
  first_referral: {
    name: 'First Steps',
    icon: Star,
    color: 'from-blue-400 to-blue-600',
    description: 'Made your first referral',
    points: 10
  },
  '10_referrals': {
    name: 'Rising Star',
    icon: TrendingUp,
    color: 'from-green-400 to-green-600',
    description: '10 successful referrals',
    points: 50
  },
  '50_referrals': {
    name: 'Influencer',
    icon: Users,
    color: 'from-purple-400 to-purple-600',
    description: '50 successful referrals',
    points: 250
  },
  '100_referrals': {
    name: 'Legend',
    icon: Trophy,
    color: 'from-yellow-400 to-yellow-600',
    description: '100 successful referrals',
    points: 500
  },
  '500_referrals': {
    name: 'Mega Influencer',
    icon: Crown,
    color: 'from-pink-400 to-pink-600',
    description: '500 successful referrals',
    points: 2500
  },
  first_business_referral: {
    name: 'Business Builder',
    icon: Briefcase,
    color: 'from-indigo-400 to-indigo-600',
    description: 'First business referral',
    points: 25
  },
  '10_business_referrals': {
    name: 'Enterprise Partner',
    icon: Sparkles,
    color: 'from-amber-400 to-amber-600',
    description: '10 business referrals',
    points: 250
  },
  top_earner_month: {
    name: 'Monthly Champion',
    icon: Award,
    color: 'from-emerald-400 to-emerald-600',
    description: 'Top earner this month',
    points: 100
  },
  viral_post: {
    name: 'Viral Sensation',
    icon: Zap,
    color: 'from-red-400 to-red-600',
    description: 'Post went viral (1000+ clicks)',
    points: 150
  },
  conversion_master: {
    name: 'Conversion Master',
    icon: Target,
    color: 'from-cyan-400 to-cyan-600',
    description: '50%+ conversion rate',
    points: 200
  },
  mega_millionaire: {
    name: 'Mega Millionaire Path',
    icon: Crown,
    color: 'from-gradient-to-r from-yellow-500 via-pink-500 to-purple-600',
    description: 'On track for $1M+ earnings',
    points: 10000
  }
};

export default function AchievementsBadges({ user }) {
  const queryClient = useQueryClient();

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', user.id],
    queryFn: () => base44.entities.ReferralAchievement.filter({ user_id: user.id })
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['user-referrals-achievements', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id })
  });

  const { data: crmLeads = [] } = useQuery({
    queryKey: ['crm-leads-achievements', user.id],
    queryFn: () => base44.entities.CRMLead.filter({ referred_by_user_id: user.id })
  });

  const checkAchievementsMutation = useMutation({
    mutationFn: async (achievementType) => {
      const existing = achievements.find(a => a.achievement_type === achievementType);
      if (existing) return null;

      const config = ACHIEVEMENT_CONFIG[achievementType];
      return await base44.entities.ReferralAchievement.create({
        user_id: user.id,
        achievement_type: achievementType,
        badge_name: config.name,
        badge_icon: config.icon.name,
        badge_color: config.color,
        points_awarded: config.points,
        bonus_reward: achievementType.includes('100') ? 50 : achievementType.includes('500') ? 250 : 0,
        unlocked_at: new Date().toISOString()
      });
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries(['achievements']);
        toast.success(`🎉 Achievement Unlocked: ${data.badge_name}!`, {
          description: `+${data.points_awarded} points` + (data.bonus_reward > 0 ? ` and $${data.bonus_reward} bonus!` : '')
        });
      }
    }
  });

  // Auto-check for achievements
  React.useEffect(() => {
    if (!referrals.length) return;

    const totalReferrals = referrals.length;
    const businessReferrals = crmLeads.filter(l => l.lead_type === 'business_client').length;

    // Check referral milestones
    if (totalReferrals >= 1) checkAchievementsMutation.mutate('first_referral');
    if (totalReferrals >= 10) checkAchievementsMutation.mutate('10_referrals');
    if (totalReferrals >= 50) checkAchievementsMutation.mutate('50_referrals');
    if (totalReferrals >= 100) checkAchievementsMutation.mutate('100_referrals');
    if (totalReferrals >= 500) checkAchievementsMutation.mutate('500_referrals');

    // Check business referral milestones
    if (businessReferrals >= 1) checkAchievementsMutation.mutate('first_business_referral');
    if (businessReferrals >= 10) checkAchievementsMutation.mutate('10_business_referrals');
  }, [referrals.length, crmLeads.length]);

  const totalPoints = achievements.reduce((sum, a) => sum + (a.points_awarded || 0), 0);
  const totalBonuses = achievements.reduce((sum, a) => sum + (a.bonus_reward || 0), 0);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" />
            Achievements & Badges
          </span>
          <div className="text-right">
            <Badge className="bg-purple-100 text-purple-700 text-lg px-4 py-1">
              {totalPoints} Points
            </Badge>
            {totalBonuses > 0 && (
              <p className="text-sm text-green-600 mt-1">${totalBonuses} in bonuses</p>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(ACHIEVEMENT_CONFIG).map(([type, config]) => {
            const achievement = achievements.find(a => a.achievement_type === type);
            const isUnlocked = !!achievement;
            const Icon = config.icon;

            return (
              <div
                key={type}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  isUnlocked
                    ? `bg-gradient-to-br ${config.color} text-white shadow-lg hover:shadow-xl`
                    : 'bg-gray-100 border-gray-300 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <Icon className={`w-6 h-6 ${isUnlocked ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold mb-1 ${isUnlocked ? 'text-white' : 'text-gray-600'}`}>
                      {config.name}
                    </h3>
                    <p className={`text-xs ${isUnlocked ? 'text-white/90' : 'text-gray-500'}`}>
                      {config.description}
                    </p>
                    <div className="mt-2">
                      <Badge className={isUnlocked ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}>
                        {config.points} points
                      </Badge>
                    </div>
                  </div>
                </div>
                {isUnlocked && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-white/20 rounded-full p-1">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}