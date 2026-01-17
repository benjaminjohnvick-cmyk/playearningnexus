import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Zap, Target, Award, Crown, Shield, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

const POINT_RULES = {
  daily_login: 10,
  survey_complete: 25,
  game_install: 15,
  review_submit: 20,
  friend_invite: 30,
  achievement_unlock: 50
};

const BADGE_MILESTONES = [
  { id: 'early_bird', name: 'Early Bird', description: 'First daily login', icon: Star, threshold: 1, metric: 'logins' },
  { id: 'consistent_player', name: 'Consistent Player', description: '7 day login streak', icon: Flame, threshold: 7, metric: 'login_streak' },
  { id: 'survey_master', name: 'Survey Master', description: '50 surveys completed', icon: Target, threshold: 50, metric: 'surveys_completed' },
  { id: 'game_collector', name: 'Game Collector', description: '10 games installed', icon: Trophy, threshold: 10, metric: 'games_installed' },
  { id: 'top_reviewer', name: 'Top Reviewer', description: '25 reviews written', icon: Award, threshold: 25, metric: 'reviews_written' },
  { id: 'social_butterfly', name: 'Social Butterfly', description: '10 friends added', icon: Crown, threshold: 10, metric: 'friends_count' },
  { id: 'elite_gamer', name: 'Elite Gamer', description: '1000 total points', icon: Shield, threshold: 1000, metric: 'total_points' }
];

export default function PointsBadgeSystem({ user }) {
  const queryClient = useQueryClient();

  // Fetch user achievements/badges
  const { data: userAchievements = [] } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      return await base44.entities.Achievement.filter({
        user_id: user.id
      });
    },
    enabled: !!user
  });

  // Calculate user stats
  const { data: userStats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const surveys = await base44.entities.Survey.filter({ user_id: user.id });
      const reviews = await base44.entities.GameReview.filter({ user_id: user.id });
      const friends = await base44.entities.SocialConnection.filter({ 
        user_id: user.id, 
        status: 'accepted' 
      });
      
      return {
        surveys_completed: surveys.length,
        reviews_written: reviews.length,
        friends_count: friends.length,
        games_installed: user.game_library?.length || 0,
        total_points: user.gamification_points || 0,
        login_streak: user.login_streak || 0,
        logins: user.total_logins || 0
      };
    },
    enabled: !!user
  });

  // Award points mutation
  const awardPointsMutation = useMutation({
    mutationFn: async ({ points, reason, badge }) => {
      const currentPoints = user.gamification_points || 0;
      const newPoints = currentPoints + points;
      
      await base44.auth.updateMe({
        gamification_points: newPoints
      });

      // Check and award badges
      if (badge) {
        const existingBadge = userAchievements.find(a => a.achievement_type === badge.id);
        if (!existingBadge) {
          await base44.entities.Achievement.create({
            user_id: user.id,
            achievement_type: badge.id,
            title: badge.name,
            description: badge.description,
            points_awarded: points
          });
          
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
          
          toast.success(`🎉 Badge Unlocked: ${badge.name}!`, {
            description: badge.description
          });
        }
      }

      // Post to activity feed
      await base44.entities.ActivityFeedItem.create({
        user_id: user.id,
        activity_type: 'points_earned',
        description: `Earned ${points} points for ${reason}`,
        metadata: { points, reason }
      });

      return newPoints;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-stats']);
      queryClient.invalidateQueries(['user-achievements']);
    }
  });

  // Check for badge eligibility
  useEffect(() => {
    if (!userStats) return;

    BADGE_MILESTONES.forEach(badge => {
      const hasEarned = userAchievements.some(a => a.achievement_type === badge.id);
      const metricValue = userStats[badge.metric] || 0;

      if (!hasEarned && metricValue >= badge.threshold) {
        awardPointsMutation.mutate({
          points: 100,
          reason: `unlocking ${badge.name} badge`,
          badge
        });
      }
    });
  }, [userStats, userAchievements]);

  if (!userStats) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const earnedBadges = BADGE_MILESTONES.filter(b => 
    userAchievements.some(a => a.achievement_type === b.id)
  );

  const nextBadges = BADGE_MILESTONES.filter(b => 
    !userAchievements.some(a => a.achievement_type === b.id)
  ).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Points Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Your Points & Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 mb-2">
              {userStats.total_points}
            </div>
            <p className="text-gray-600">Total Points</p>
          </div>

          {/* Points Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{userStats.surveys_completed}</p>
              <p className="text-xs text-gray-600">Surveys</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{userStats.games_installed}</p>
              <p className="text-xs text-gray-600">Games</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{userStats.reviews_written}</p>
              <p className="text-xs text-gray-600">Reviews</p>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <p className="text-2xl font-bold text-pink-600">{userStats.login_streak}</p>
              <p className="text-xs text-gray-600">Day Streak</p>
            </div>
          </div>

          {/* Earned Badges */}
          {earnedBadges.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Earned Badges</h3>
              <div className="grid grid-cols-3 gap-3">
                {earnedBadges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200"
                    >
                      <Icon className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-xs font-medium">{badge.name}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next Badges */}
          {nextBadges.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Next Badges</h3>
              <div className="space-y-3">
                {nextBadges.map((badge) => {
                  const Icon = badge.icon;
                  const progress = (userStats[badge.metric] / badge.threshold) * 100;
                  return (
                    <div key={badge.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{badge.name}</p>
                          <p className="text-xs text-gray-500">{badge.description}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-gray-500 text-right">
                          {userStats[badge.metric]} / {badge.threshold}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Earn Points */}
      <Card>
        <CardHeader>
          <CardTitle>Earn Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(POINT_RULES).map(([action, points]) => (
              <div key={action} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm capitalize">{action.replace('_', ' ')}</span>
                <Badge variant="outline">+{points} pts</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}