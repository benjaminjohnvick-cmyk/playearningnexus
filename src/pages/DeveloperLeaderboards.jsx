import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  DollarSign,
  Medal,
  Crown,
  Briefcase,
  Activity,
  Target,
  Star,
  Gamepad2
} from "lucide-react";
import { motion } from "framer-motion";

export default function DeveloperLeaderboards() {
  const [timePeriod, setTimePeriod] = useState('all-time');
  const [user, setUser] = useState(null);

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

  // Calculate date range based on time period
  const getDateFilter = () => {
    const now = new Date();
    let startDate;
    
    if (timePeriod === 'weekly') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timePeriod === 'monthly') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      return {}; // all-time
    }
    
    return { created_date: { $gte: startDate.toISOString() } };
  };

  // Fetch all developers
  const { data: developers = [] } = useQuery({
    queryKey: ['developers'],
    queryFn: async () => {
      return await base44.entities.BusinessClient.list();
    }
  });

  // Fetch games with date filter
  const { data: games = [] } = useQuery({
    queryKey: ['games-leaderboard', timePeriod],
    queryFn: async () => {
      return await base44.entities.Game.list();
    }
  });

  // Fetch referrals with date filter
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-leaderboard', timePeriod],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      return await base44.entities.Referral.filter(dateFilter);
    }
  });

  // Fetch CRM leads
  const { data: crmLeads = [] } = useQuery({
    queryKey: ['crm-leads-leaderboard', timePeriod],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      return await base44.entities.CRMLead.filter(dateFilter);
    }
  });

  // Calculate leaderboard metrics
  const calculateLeaderboard = () => {
    return developers.map(dev => {
      const devGames = games.filter(g => g.developer_id === dev.id);
      const totalRevenue = devGames.reduce((sum, g) => sum + (g.total_revenue || 0), 0);
      const totalInstalls = devGames.reduce((sum, g) => sum + (g.total_installs || 0), 0);
      const avgRating = devGames.length > 0
        ? devGames.reduce((sum, g) => sum + (g.average_rating || 0), 0) / devGames.length
        : 0;
      
      // Count referrals to this developer
      const businessReferrals = crmLeads.filter(l => 
        l.converted_to_business_id === dev.id
      ).length;

      // Calculate engagement rate (installs per game)
      const engagementRate = devGames.length > 0 
        ? totalInstalls / devGames.length 
        : 0;

      return {
        developer: dev,
        totalRevenue,
        totalInstalls,
        avgRating,
        gamesPublished: devGames.length,
        businessReferrals,
        engagementRate,
        score: totalRevenue + (totalInstalls * 0.1) + (businessReferrals * 100)
      };
    }).sort((a, b) => b.score - a.score);
  };

  const leaderboard = calculateLeaderboard();

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-700" />;
    return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600 to-amber-800 text-white';
    return 'bg-gray-100 text-gray-700';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-amber-600" />
            Developer Leaderboards
          </h1>
          <p className="text-gray-600">Top performing businesses and game developers</p>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center gap-4 mb-8">
          <span className="text-sm font-medium text-gray-700">Time Period:</span>
          <div className="flex gap-2">
            {['weekly', 'monthly', 'all-time'].map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timePeriod === period
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border'
                }`}
              >
                {period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* 2nd Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="order-1 md:order-1"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-100 to-gray-200">
                <CardContent className="pt-6 text-center">
                  <Medal className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {leaderboard[1].developer.company_name}
                  </h3>
                  <Badge className="bg-gray-400 text-white mb-4">2nd Place</Badge>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold">${leaderboard[1].totalRevenue.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Installs:</span>
                      <span className="font-bold">{leaderboard[1].totalInstalls}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 1st Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="order-2 md:order-2"
            >
              <Card className="border-0 shadow-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 transform scale-105">
                <CardContent className="pt-6 text-center">
                  <Crown className="w-20 h-20 text-white mx-auto mb-3" />
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {leaderboard[0].developer.company_name}
                  </h3>
                  <Badge className="bg-white text-yellow-600 font-bold mb-4">🏆 Champion</Badge>
                  <div className="space-y-2 text-sm text-white">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-bold">${leaderboard[0].totalRevenue.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Installs:</span>
                      <span className="font-bold">{leaderboard[0].totalInstalls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Referrals:</span>
                      <span className="font-bold">{leaderboard[0].businessReferrals}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 3rd Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="order-3 md:order-3"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-600 to-amber-800">
                <CardContent className="pt-6 text-center">
                  <Medal className="w-16 h-16 text-amber-200 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-white mb-1">
                    {leaderboard[2].developer.company_name}
                  </h3>
                  <Badge className="bg-amber-900 text-white mb-4">3rd Place</Badge>
                  <div className="space-y-2 text-sm text-white">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-bold">${leaderboard[2].totalRevenue.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Installs:</span>
                      <span className="font-bold">{leaderboard[2].totalInstalls}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Full Leaderboard */}
        <Tabs defaultValue="overall" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="overall">
              <Trophy className="w-4 h-4 mr-2" />
              Overall Score
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <DollarSign className="w-4 h-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="engagement">
              <Activity className="w-4 h-4 mr-2" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="referrals">
              <Users className="w-4 h-4 mr-2" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="top-games">
              <Star className="w-4 h-4 mr-2" />
              Top Games
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overall">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Complete Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <motion.div
                      key={entry.developer.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-lg ${getRankBadge(index + 1)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 flex items-center justify-center">
                            {getRankIcon(index + 1)}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{entry.developer.company_name}</h4>
                            <p className="text-sm opacity-80">
                              {entry.gamesPublished} games • {entry.totalInstalls} installs
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{entry.score.toFixed(0)}</p>
                          <p className="text-xs opacity-80">points</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Top Revenue Generators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...leaderboard].sort((a, b) => b.totalRevenue - a.totalRevenue).map((entry, index) => (
                    <div key={entry.developer.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-600">#{index + 1}</span>
                          <div>
                            <h4 className="font-bold text-gray-900">{entry.developer.company_name}</h4>
                            <p className="text-sm text-gray-600">{entry.gamesPublished} games published</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            ${entry.totalRevenue.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-500">total revenue</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Highest Engagement Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...leaderboard].sort((a, b) => b.engagementRate - a.engagementRate).map((entry, index) => (
                    <div key={entry.developer.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-600">#{index + 1}</span>
                          <div>
                            <h4 className="font-bold text-gray-900">{entry.developer.company_name}</h4>
                            <p className="text-sm text-gray-600">
                              Avg rating: {entry.avgRating.toFixed(1)}⭐
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            {entry.engagementRate.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-500">installs per game</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Most Referred Developers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...leaderboard].sort((a, b) => b.businessReferrals - a.businessReferrals).map((entry, index) => (
                    <div key={entry.developer.id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-600">#{index + 1}</span>
                          <div>
                            <h4 className="font-bold text-gray-900">{entry.developer.company_name}</h4>
                            <p className="text-sm text-gray-600">{entry.gamesPublished} active games</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">
                            {entry.businessReferrals}
                          </p>
                          <p className="text-xs text-gray-500">referrals</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-games">
            <div className="space-y-6">
              {leaderboard.slice(0, 10).map((entry) => {
                const devGames = games.filter(g => g.developer_id === entry.developer.id)
                  .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
                  .slice(0, 3);
                
                if (devGames.length === 0) return null;
                
                return (
                  <Card key={entry.developer.id} className="border-0 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                      <CardTitle className="flex items-center gap-3">
                        <Briefcase className="w-6 h-6 text-indigo-600" />
                        {entry.developer.company_name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        {devGames.map((game, idx) => (
                          <div key={game.id} className="p-4 bg-gray-50 rounded-lg border">
                            <div className="flex items-start justify-between mb-2">
                              <Gamepad2 className="w-5 h-5 text-blue-600" />
                              {idx === 0 && <Badge className="bg-yellow-100 text-yellow-700">Top</Badge>}
                            </div>
                            <h4 className="font-bold text-gray-900 mb-1">{game.title}</h4>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex justify-between">
                                <span>Revenue:</span>
                                <span className="font-semibold text-green-600">
                                  ${(game.total_revenue || 0).toFixed(0)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Installs:</span>
                                <span className="font-semibold">{game.total_installs || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                <span>{(game.average_rating || 0).toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}