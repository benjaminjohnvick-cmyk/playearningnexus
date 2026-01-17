import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Star, Zap, TrendingUp, Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to fetch user');
      }
    };
    fetchUser();
  }, []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-total_points', 100),
  });

  const { data: topEarners = [] } = useQuery({
    queryKey: ['topEarners'],
    queryFn: () => base44.entities.User.list('-total_earnings', 50),
  });

  const { data: mostActive = [] } = useQuery({
    queryKey: ['mostActive'],
    queryFn: () => base44.entities.User.list('-total_surveys_completed', 50),
  });

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const LeaderboardList = ({ users, metricKey, metricLabel, icon: Icon }) => (
    <div className="space-y-3">
      {users.map((user, idx) => {
        const isCurrentUser = user.id === currentUser?.id;
        const rank = idx + 1;

        return (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`p-4 rounded-lg border-2 ${
              isCurrentUser
                ? 'bg-blue-50 border-blue-300'
                : rank <= 3
                ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                {getRankIcon(rank) || rank}
              </div>

              <Avatar className="w-12 h-12">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback>
                  {user.full_name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{user.full_name}</p>
                  {isCurrentUser && (
                    <Badge className="bg-blue-600">You</Badge>
                  )}
                  {user.level && (
                    <Badge variant="outline" className="text-purple-700 border-purple-300">
                      Level {user.level}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {metricLabel}: <span className="font-bold">{user[metricKey]?.toLocaleString() || 0}</span>
                  </span>
                </div>
              </div>

              {rank <= 3 && (
                <div className="text-right">
                  <Trophy className={`w-8 h-8 ${
                    rank === 1 ? 'text-yellow-500' : 
                    rank === 2 ? 'text-gray-400' : 
                    'text-amber-600'
                  }`} />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-700 to-blue-700 bg-clip-text text-transparent mb-2">
            Global Leaderboards
          </h1>
          <p className="text-gray-600">Compete with players worldwide and climb the ranks!</p>
        </div>

        <Tabs defaultValue="points" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="points">
              <Star className="w-4 h-4 mr-2" />
              Top Points
            </TabsTrigger>
            <TabsTrigger value="earnings">
              <TrendingUp className="w-4 h-4 mr-2" />
              Top Earners
            </TabsTrigger>
            <TabsTrigger value="active">
              <Zap className="w-4 h-4 mr-2" />
              Most Active
            </TabsTrigger>
          </TabsList>

          <TabsContent value="points">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  Top Players by Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeaderboardList
                  users={allUsers}
                  metricKey="total_points"
                  metricLabel="Points"
                  icon={Star}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  Top Earners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeaderboardList
                  users={topEarners}
                  metricKey="total_earnings"
                  metricLabel="Earnings"
                  icon={TrendingUp}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6 text-orange-500" />
                  Most Active Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeaderboardList
                  users={mostActive}
                  metricKey="total_surveys_completed"
                  metricLabel="Surveys Completed"
                  icon={Zap}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}