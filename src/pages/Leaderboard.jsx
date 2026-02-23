import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, DollarSign, Users, TrendingUp, Medal, Crown } from "lucide-react";

export default function Leaderboard() {
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

  // Fetch all users for leaderboard
  const { data: allUsers = [] } = useQuery({
    queryKey: ['leaderboard-users'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users;
    }
  });

  // Top Earners
  const topEarners = [...allUsers]
    .sort((a, b) => (b.total_earnings || 0) - (a.total_earnings || 0))
    .slice(0, 50);

  // Top by Points
  const topByPoints = [...allUsers]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 50);

  // Fetch referrals for top referrers
  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals'],
    queryFn: async () => {
      return await base44.entities.Referral.list();
    }
  });

  // Calculate top referrers
  const referrerStats = allReferrals.reduce((acc, ref) => {
    if (!acc[ref.referrer_user_id]) {
      acc[ref.referrer_user_id] = {
        count: 0,
        totalEarnings: 0
      };
    }
    acc[ref.referrer_user_id].count++;
    acc[ref.referrer_user_id].totalEarnings += (ref.total_earnings || 0) * 0.25;
    return acc;
  }, {});

  const topReferrers = Object.entries(referrerStats)
    .map(([userId, stats]) => ({
      user: allUsers.find(u => u.id === userId),
      ...stats
    }))
    .filter(item => item.user)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-orange-600" />;
    return <span className="text-gray-600 font-bold">#{index + 1}</span>;
  };

  const getRankColor = (index) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    if (index === 1) return 'bg-gradient-to-r from-gray-300 to-gray-500';
    if (index === 2) return 'bg-gradient-to-r from-orange-400 to-orange-600';
    return 'bg-white';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-600" />
            Leaderboard
          </h1>
          <p className="text-gray-600">See where you rank among top earners and referrers</p>
        </div>

        <Tabs defaultValue="earners" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="earners" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Top Earners
            </TabsTrigger>
            <TabsTrigger value="referrers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Top Referrers
            </TabsTrigger>
            <TabsTrigger value="points" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top by Points
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earners">
            <div className="space-y-3">
              {topEarners.map((rankUser, index) => (
                <Card key={rankUser.id} className={`${getRankColor(index)} ${
                  rankUser.id === user.id ? 'ring-2 ring-blue-500' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                          {getRankIcon(index)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {rankUser.full_name}
                            {rankUser.id === user.id && (
                              <Badge className="ml-2 bg-blue-600">You</Badge>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">Level {rankUser.level || 1}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          ${(rankUser.total_earnings || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Total Earnings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="referrers">
            <div className="space-y-3">
              {topReferrers.map((item, index) => (
                <Card key={item.user.id} className={`${getRankColor(index)} ${
                  item.user.id === user.id ? 'ring-2 ring-blue-500' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                          {getRankIcon(index)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {item.user.full_name}
                            {item.user.id === user.id && (
                              <Badge className="ml-2 bg-blue-600">You</Badge>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            ${item.totalEarnings.toFixed(2)} from referrals
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">{item.count}</p>
                        <p className="text-xs text-gray-500">Referrals</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="points">
            <div className="space-y-3">
              {topByPoints.map((rankUser, index) => (
                <Card key={rankUser.id} className={`${getRankColor(index)} ${
                  rankUser.id === user.id ? 'ring-2 ring-blue-500' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                          {getRankIcon(index)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {rankUser.full_name}
                            {rankUser.id === user.id && (
                              <Badge className="ml-2 bg-blue-600">You</Badge>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">Level {rankUser.level || 1}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">
                          {rankUser.points || 0}
                        </p>
                        <p className="text-xs text-gray-500">Points</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}