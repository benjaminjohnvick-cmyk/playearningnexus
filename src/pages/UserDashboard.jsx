import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Gamepad2, TrendingUp, Library, Star, Clock, Eye, Users, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import StatsCard from '../components/dashboard/StatsCard';
import GameCard from '../components/games/GameCard';
import UserLicenseAgreement from '../components/user/UserLicenseAgreement';
import AIRecommendations from '../components/dashboard/AIRecommendations';
import SocialSharePrompt from '../components/social/SocialSharePrompt';
import ActiveEventsDisplay from '../components/events/ActiveEventsDisplay';
import StreamDiscovery from '../components/streaming/StreamDiscovery';
import FriendsSystem from '../components/social/FriendsSystem';
import EnhancedSocialFeed from '../components/social/EnhancedSocialFeed';
import GameGroups from '../components/social/GameGroups';
import PointsBadgeSystem from '../components/gamification/PointsBadgeSystem';
import AIChatSupport from '../components/support/AIChatSupport';
import PersonalizedGameBundles from '../components/bundles/PersonalizedGameBundles';
import EnhancedPointsSystem from '../components/gamification/EnhancedPointsSystem';
import PersonalizedRecommendations from '../components/ai/PersonalizedRecommendations';
import DailyEarningsMeter from '../components/premium/DailyEarningsMeter';
import LockoutModeEnforcer from '../components/premium/LockoutModeEnforcer';
import DailyGoalProgress from '../components/gamification/DailyGoalProgress';
import PayPalTransferButton from '../components/payout/PayPalTransferButton';
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const [showULA, setShowULA] = useState(false);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [gameToShare, setGameToShare] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Check if user has agreed to terms
        if (!currentUser.agreed_to_terms) {
          setShowULA(true);
        }
        
        // Lockout logic moved to Surveys page
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



  const { data: todayEarnings } = useQuery({
    queryKey: ['todayEarnings', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const records = await base44.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      return records[0] || null;
    },
    enabled: !!user
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['recent-activities', user?.id],
    queryFn: async () => {
      return await base44.entities.UserActivity.filter(
        { user_id: user.id },
        '-created_date',
        10
      );
    },
    enabled: !!user
  });

  const installGameMutation = useMutation({
    mutationFn: async (game) => {
      // Start 2-minute trial
      setCurrentGame(game);
      setTrialStartTime(Date.now());
      setShowTrialExpired(false);
      
      // Set timer for 2 minutes
      setTimeout(() => {
        setShowTrialExpired(true);
      }, 120000); // 2 minutes
      
      await base44.entities.Game.update(game.id, {
        total_installs: (game.total_installs || 0) + 1
      });
      
      if (!user.game_library?.includes(game.id)) {
        await base44.auth.updateMe({
          game_library: [...(user.game_library || []), game.id]
        });
      }

      // Create automated payment record
      await base44.entities.AutomatedPayment.create({
        developer_id: game.developer_id,
        game_id: game.id,
        user_id: user.id,
        install_date: new Date().toISOString().split('T')[0],
        install_fee_deducted: 6,
        amount_owed: -6,
        days_since_install: 0
      });

      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        business_client_id: game.developer_id,
        amount: 6,
        transaction_type: 'install_fee',
        status: 'completed',
        notes: 'Game installation fee - $6 for 3 days access'
      });
    },
    onSuccess: (data, game) => {
      queryClient.invalidateQueries(['my-library']);
      queryClient.invalidateQueries(['featured-games']);
      toast.success('2-minute trial started! Upgrade to premium for unlimited access.');
      setGameToShare(game);
      setShowSharePrompt(true);
    }
  });



  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      {gameToShare && (
        <SocialSharePrompt
          isOpen={showSharePrompt}
          onClose={() => setShowSharePrompt(false)}
          game={gameToShare}
          action="started playing"
        />
      )}
      {showTrialExpired && (
        <Dialog open={showTrialExpired} onOpenChange={setShowTrialExpired}>
          <DialogContent className="border-2 border-red-300">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Clock className="w-6 h-6" />
                2-Minute Trial Expired
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Your 2-minute trial has ended. Upgrade to premium to continue playing!
              </p>
              <Link to={createPageUrl('InAppGameStore')}>
                <Button className="w-full bg-red-600 hover:bg-red-700">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {showULA && (
        <UserLicenseAgreement
          isOpen={showULA}
          onAccept={() => {
            setShowULA(false);
            window.location.reload();
          }}
          onDecline={() => {
            base44.auth.logout();
          }}
        />
      )}
      

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user.full_name}!</h1>
          <p className="text-gray-600">Your gaming dashboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <StatsCard
              icon={DollarSign}
              label="Total Earnings"
              value={`$${(user.total_earnings || 0).toFixed(2)}`}
              color="green"
            />
            <PayPalTransferButton user={user} />
          </div>
          <StatsCard
            icon={Gamepad2}
            label="Games in Library"
            value={user.game_library?.length || 0}
            color="blue"
          />
          <StatsCard
            icon={TrendingUp}
            label="Points"
            value={user.points || 0}
            trend={`Level ${user.level || 1}`}
            color="amber"
          />
          <StatsCard
            icon={Star}
            label="Member Since"
            value={user.subscription_start_date ? new Date(user.subscription_start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'New'}
            color="purple"
          />
        </div>



        {/* Daily Goal Progress */}
        <div className="mb-6">
          <DailyGoalProgress
            earned={todayEarnings?.total_earned || 0}
            goal={3}
            surveysToday={todayEarnings?.total_surveys_completed || 0}
          />
        </div>

        {/* Lockout Mode Enforcer */}
        <div className="mb-8">
          <LockoutModeEnforcer user={user} />
        </div>

        {/* Active Events */}
        <div className="mb-8">
          <ActiveEventsDisplay />
        </div>

        {/* AI Recommendations */}
        <div className="mb-8">
          <PersonalizedRecommendations user={user} />
        </div>

        {/* Personalized Game Bundles */}
        <div className="mb-8">
          <PersonalizedGameBundles user={user} />
        </div>

        {/* Social Feed & Gamification */}
        <Tabs defaultValue="feed" className="mb-8">
          <TabsList>
            <TabsTrigger value="feed">Social Feed</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="feed">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <EnhancedSocialFeed user={user} />
              </div>
              <div>
                <EnhancedPointsSystem user={user} recentActivities={recentActivities} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="groups">
            <GameGroups user={user} />
          </TabsContent>
        </Tabs>



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
            <TabsTrigger value="streams" className="text-lg">
              <Eye className="w-4 h-4 mr-2" />
              Live Streams
            </TabsTrigger>
            <TabsTrigger value="friends" className="text-lg">
              <Users className="w-4 h-4 mr-2" />
              Friends
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
                      enableLauncher
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
                      enableLauncher
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

          <TabsContent value="streams">
            <StreamDiscovery />
          </TabsContent>

          <TabsContent value="friends">
            <FriendsSystem currentUser={user} />
          </TabsContent>
        </Tabs>

        {/* AI Chat Support Widget */}
        <AIChatSupport user={user} />
      </div>
    </div>
  );
}