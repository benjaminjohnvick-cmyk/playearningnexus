import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Award, TrendingUp, DollarSign } from 'lucide-react';

export default function ReferralLeaderboard({ currentUser }) {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['leaderboard-users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['leaderboard-referrals'],
    queryFn: () => base44.entities.Referral.list()
  });

  // Calculate leaderboard rankings
  const userStats = allUsers.map(user => {
    const userReferrals = allReferrals.filter(r => r.referrer_user_id === user.id);
    const totalReferrals = userReferrals.length;
    const activeReferrals = userReferrals.filter(r => r.status === 'active').length;
    const referralEarnings = userReferrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
    const totalEarnings = user.total_earnings || 0;

    return {
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      total_referrals: totalReferrals,
      active_referrals: activeReferrals,
      referral_earnings: referralEarnings,
      total_earnings: totalEarnings
    };
  }).filter(s => s.total_referrals > 0);

  const topByReferrals = [...userStats].sort((a, b) => b.total_referrals - a.total_referrals).slice(0, 10);
  const topByEarnings = [...userStats].sort((a, b) => b.referral_earnings - a.referral_earnings).slice(0, 10);
  const topByTotalEarnings = [...userStats].sort((a, b) => b.total_earnings - a.total_earnings).slice(0, 10);

  const currentUserRank = topByReferrals.findIndex(u => u.user_id === currentUser?.id) + 1;

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <Award className="w-5 h-5 text-gray-400" />;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-50 to-yellow-100 border-yellow-300';
    if (rank === 2) return 'from-gray-50 to-gray-100 border-gray-300';
    if (rank === 3) return 'from-amber-50 to-amber-100 border-amber-300';
    return 'from-white to-gray-50 border-gray-200';
  };

  const LeaderboardList = ({ data, type }) => (
    <div className="space-y-3">
      {data.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = user.user_id === currentUser?.id;

        return (
          <div
            key={user.user_id}
            className={`p-4 rounded-xl border-2 bg-gradient-to-r transition-all hover:shadow-md ${
              isCurrentUser ? 'border-blue-500 shadow-md' : getRankColor(rank)
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 text-center">
                {getRankIcon(rank)}
                <span className="text-sm font-bold text-gray-600 mt-1 block">#{rank}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">
                    {user.full_name}
                  </p>
                  {isCurrentUser && (
                    <Badge className="bg-blue-100 text-blue-700">You</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>

              <div className="text-right">
                {type === 'referrals' ? (
                  <>
                    <div className="text-2xl font-bold text-gray-900">{user.total_referrals}</div>
                    <p className="text-xs text-gray-500">referrals</p>
                  </>
                ) : type === 'referralEarnings' ? (
                  <>
                    <div className="text-2xl font-bold text-green-600">${user.referral_earnings.toFixed(2)}</div>
                    <p className="text-xs text-gray-500">from referrals</p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-blue-600">${user.total_earnings.toFixed(2)}</div>
                    <p className="text-xs text-gray-500">total earnings</p>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Top Referrers
        </CardTitle>
        {currentUserRank > 0 && (
          <p className="text-sm text-gray-600">
            You're ranked #{currentUserRank} with {topByReferrals.find(u => u.user_id === currentUser?.id)?.total_referrals || 0} referrals
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="referrals">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="referrals">
              <TrendingUp className="w-4 h-4 mr-2" />
              Most Referrals
            </TabsTrigger>
            <TabsTrigger value="earnings">
              <DollarSign className="w-4 h-4 mr-2" />
              Referral Earnings
            </TabsTrigger>
            <TabsTrigger value="total">
              <Trophy className="w-4 h-4 mr-2" />
              Total Earnings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="mt-4">
            <LeaderboardList data={topByReferrals} type="referrals" />
          </TabsContent>

          <TabsContent value="earnings" className="mt-4">
            <LeaderboardList data={topByEarnings} type="referralEarnings" />
          </TabsContent>

          <TabsContent value="total" className="mt-4">
            <LeaderboardList data={topByTotalEarnings} type="totalEarnings" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}