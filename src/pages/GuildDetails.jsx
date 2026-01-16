import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Trophy, Activity, Crown, TrendingUp, Award } from 'lucide-react';
import GuildLeaderboard from '../components/gamification/GuildLeaderboard';

export default function GuildDetails() {
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const guildId = urlParams.get('guild_id');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: guild, isLoading: guildLoading } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: () => base44.entities.Guild.filter({ id: guildId }).then(g => g[0]),
    enabled: !!guildId
  });

  const { data: members = [] } = useQuery({
    queryKey: ['guildMembers', guild?.member_ids],
    queryFn: () => {
      if (!guild?.member_ids?.length) return [];
      return base44.entities.User.filter({ id: { $in: guild.member_ids } });
    },
    enabled: !!guild?.member_ids?.length
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['guildAchievements', guild?.member_ids],
    queryFn: () => {
      if (!guild?.member_ids?.length) return [];
      return base44.entities.Achievement.filter({
        user_id: { $in: guild.member_ids },
        is_unlocked: true
      });
    },
    enabled: !!guild?.member_ids?.length
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['guildActivity', guild?.id],
    queryFn: () => base44.entities.ChatMessage.filter(
      { guild_id: guild.id },
      '-created_date',
      20
    ),
    enabled: !!guild,
    refetchInterval: 5000
  });

  if (guildLoading || !guild || !user) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>;
  }

  const isLeader = guild.leader_id === user.id;
  const isMember = guild.member_ids?.includes(user.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Guild Header */}
        <Card className="mb-6 bg-gradient-to-r from-green-600 to-green-700 text-white">
          <CardContent className="p-8">
            <div className="flex items-center gap-6">
              {guild.icon_url && (
                <img src={guild.icon_url} alt={guild.guild_name} className="w-24 h-24 rounded-lg" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{guild.guild_name}</h1>
                  {isLeader && <Crown className="w-6 h-6 text-yellow-400" />}
                  <Badge className="bg-white/20">Level {guild.guild_level}</Badge>
                </div>
                <p className="text-green-100 mb-4">{guild.description}</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-green-200">Members</p>
                    <p className="text-2xl font-bold">{members.length}/{guild.max_members}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-200">Total Earnings</p>
                    <p className="text-2xl font-bold">${(guild.total_earnings || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-200">Achievements</p>
                    <p className="text-2xl font-bold">{achievements.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Award className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Guild Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map(member => {
                    const memberAchievements = achievements.filter(a => a.user_id === member.id);
                    return (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{member.full_name}</p>
                              {member.id === guild.leader_id && (
                                <Badge className="bg-yellow-500">Leader</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{member.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${(member.total_earnings || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{memberAchievements.length} achievements</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements">
            <Card>
              <CardHeader>
                <CardTitle>Guild Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {achievements.map(achievement => {
                    const achiever = members.find(m => m.id === achievement.user_id);
                    return (
                      <div key={achievement.id} className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{achievement.icon}</div>
                          <div className="flex-1">
                            <p className="font-bold">{achievement.title}</p>
                            <p className="text-sm text-gray-600">{achievement.description}</p>
                            <p className="text-xs text-purple-600 mt-1">
                              Unlocked by {achiever?.full_name}
                            </p>
                          </div>
                          {achievement.reward_amount > 0 && (
                            <Badge className="bg-yellow-500">+{achievement.reward_amount} credits</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {achievements.length === 0 && (
                    <p className="text-center text-gray-500 py-8 col-span-2">
                      No achievements unlocked yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <GuildLeaderboard guildId={guild.id} members={members} />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-5 h-5 text-green-600 mt-1" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{activity.user_name}</span>: {activity.message}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.created_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}