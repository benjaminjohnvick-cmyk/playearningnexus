import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Gamepad2, TrendingUp, Library, Star } from "lucide-react";
import StatsCard from '../components/dashboard/StatsCard';
import GameCard from '../components/games/GameCard';
import SurveyProgress from '../components/surveys/SurveyProgress';
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";

export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: featuredGames = [], isLoading: loadingGames } = useQuery({
    queryKey: ['featured-games', user?.user_group_id],
    queryFn: async () => {
      if (!user?.user_group_id) return [];
      const today = new Date().toISOString().split('T')[0];
      return await base44.entities.Game.filter({
        status: 'featured',
        user_group_id: user.user_group_id,
        featured_start_date: { $lte: today },
        featured_end_date: { $gte: today }
      });
    },
    enabled: !!user
  });

  const { data: myLibrary = [], isLoading: loadingLibrary } = useQuery({
    queryKey: ['my-library', user?.id],
    queryFn: async () => {
      if (!user?.game_library?.length) return [];
      return await base44.entities.Game.filter({
        id: { $in: user.game_library }
      });
    },
    enabled: !!user
  });

  const { data: todaysSurveys = [] } = useQuery({
    queryKey: ['todays-surveys', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return await base44.entities.Survey.filter({
        user_id: user.id,
        completion_date: { $gte: today }
      });
    },
    enabled: !!user
  });

  const installGameMutation = useMutation({
    mutationFn: async (game) => {
      await base44.entities.Game.update(game.id, {
        total_installs: (game.total_installs || 0) + 1
      });
      
      if (!user.game_library?.includes(game.id)) {
        await base44.auth.updateMe({
          game_library: [...(user.game_library || []), game.id]
        });
      }

      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        amount: 6,
        transaction_type: 'install_fee',
        status: 'completed',
        notes: 'Game installation fee'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-library']);
      queryClient.invalidateQueries(['featured-games']);
      toast.success('Game installed successfully! Added to your library.');
    }
  });

  const todaysEarnings = todaysSurveys.reduce((sum, survey) => sum + (survey.earnings || 0), 0);
  const dailyGoalMet = todaysEarnings >= 2;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user.full_name}!</h1>
          <p className="text-gray-600">Your gaming dashboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={DollarSign}
            label="Total Earnings"
            value={`$${(user.total_earnings || 0).toFixed(2)}`}
            color="green"
          />
          <StatsCard
            icon={Gamepad2}
            label="Games in Library"
            value={user.game_library?.length || 0}
            color="blue"
          />
          <StatsCard
            icon={TrendingUp}
            label="Today's Earnings"
            value={`$${todaysEarnings.toFixed(2)}`}
            trend={dailyGoalMet ? "Goal Met! ✓" : `$${(2 - todaysEarnings).toFixed(2)} to go`}
            color="amber"
          />
          <StatsCard
            icon={Star}
            label="Member Since"
            value={user.subscription_start_date ? new Date(user.subscription_start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'New'}
            color="purple"
          />
        </div>

        {/* Survey Progress */}
        <div className="mb-8">
          <SurveyProgress
            dailyGoal={2}
            currentEarnings={todaysEarnings}
            todayCompleted={dailyGoalMet}
          />
        </div>

        {/* Surveys CTA */}
        {!dailyGoalMet && (
          <div className="mb-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Complete Your Daily Surveys</h3>
                <p className="text-gray-600">Earn ${(2 - todaysEarnings).toFixed(2)} more to unlock today's games</p>
              </div>
              <Link to={createPageUrl('Surveys')}>
                <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  Start Surveys
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Games Tabs */}
        <Tabs defaultValue="featured" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="featured" className="text-lg">
              ⭐ Featured Games
            </TabsTrigger>
            <TabsTrigger value="library" className="text-lg">
              <Library className="w-4 h-4 mr-2" />
              My Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="featured">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">This Week's Featured Games</h2>
              {loadingGames ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : featuredGames.length > 0 ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {featuredGames.map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      showFeaturedBadge
                      onInstall={(g) => installGameMutation.mutate(g)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed">
                  <Gamepad2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No featured games available yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="library">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">My Game Library</h2>
              {loadingLibrary ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : myLibrary.length > 0 ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {myLibrary.map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onInstall={(g) => toast.info('Game already in your library!')}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed">
                  <Library className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Your library is empty</p>
                  <p className="text-sm text-gray-400">Install featured games to build your collection</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}