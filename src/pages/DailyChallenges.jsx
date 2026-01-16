import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProgressBar from '@/components/common/ProgressBar';
import { Target, Trophy, Clock, CheckCircle2, Zap, DollarSign, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function DailyChallengesPage() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['dailyChallenges', user?.id],
    queryFn: () => base44.entities.DailyChallenge.filter({ user_id: user?.id }, '-created_date'),
    enabled: !!user
  });

  const { data: weeklyEvents = [] } = useQuery({
    queryKey: ['weeklyEvents'],
    queryFn: () => base44.entities.WeeklyEvent.filter({ is_active: true })
  });

  const claimRewardMutation = useMutation({
    mutationFn: async (challenge) => {
      await base44.entities.DailyChallenge.update(challenge.id, { 
        completed: true, 
        completed_at: new Date().toISOString() 
      });
      await base44.auth.updateMe({
        total_earnings: (user.total_earnings || 0) + challenge.reward_amount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyChallenges'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Reward claimed!');
    }
  });

  const challengeIcons = {
    complete_surveys: Target,
    play_games: Trophy,
    earn_amount: DollarSign,
    maintain_streak: Zap,
    invite_friends: Users
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  const activeChallenges = challenges.filter(c => !c.completed);
  const completedChallenges = challenges.filter(c => c.completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-2">
            Daily Challenges
          </h1>
          <p className="text-gray-600">Complete challenges to earn bonus rewards!</p>
        </div>

        {weeklyEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Weekly Event Active!
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyEvents.map((event) => (
                  <div key={event.id}>
                    <h3 className="text-xl font-bold mb-2">{event.event_name}</h3>
                    <p className="opacity-90">{event.description}</p>
                    <p className="mt-2">{event.bonus_multiplier}x Bonus Earnings</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-red-600" />
              Active Challenges
            </h2>
            {activeChallenges.length === 0 ? (
              <Card className="p-8 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No active challenges. Check back tomorrow!</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeChallenges.map((challenge) => {
                  const progress = (challenge.current_progress / challenge.target_value) * 100;
                  const isComplete = challenge.current_progress >= challenge.target_value;

                  return (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {React.createElement(challengeIcons[challenge.challenge_type] || Target, { className: "w-8 h-8 text-red-600" })}
                              <div>
                                <h3 className="font-bold text-lg">{challenge.title}</h3>
                                <p className="text-sm text-gray-600">{challenge.description}</p>
                              </div>
                            </div>
                            <Badge variant={isComplete ? "default" : "outline"} className="bg-red-600">
                              ${challenge.reward_amount}
                            </Badge>
                          </div>

                          <ProgressBar
                            current={challenge.current_progress}
                            max={challenge.target_value}
                            color="red"
                            size="lg"
                          />

                          {isComplete && (
                            <Button
                              onClick={() => claimRewardMutation.mutate(challenge)}
                              disabled={claimRewardMutation.isPending}
                              className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700"
                            >
                              <Trophy className="w-4 h-4 mr-2" />
                              Claim Reward
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              Completed Today
            </h2>
            {completedChallenges.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No challenges completed yet</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {completedChallenges.map((challenge) => (
                  <Card key={challenge.id} className="bg-green-50 border-green-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                          <div>
                            <h3 className="font-bold">{challenge.title}</h3>
                            <p className="text-sm text-gray-600">Completed!</p>
                          </div>
                        </div>
                        <Badge className="bg-green-600">
                          +${challenge.reward_amount}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}