import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Trophy, Gamepad2, Star, Users, MessageSquare, Calendar, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GameLibrary from '../components/profile/GameLibrary';
import AchievementsDisplay from '../components/profile/AchievementsDisplay';
import UserStats from '../components/profile/UserStats';
import SocialConnections from '../components/profile/SocialConnections';
import UserReviews from '../components/profile/UserReviews';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user_id');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (userId && userId !== currentUser.id) {
          const users = await base44.entities.User.filter({ id: userId });
          setProfileUser(users[0] || currentUser);
        } else {
          setProfileUser(currentUser);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUsers();
  }, [userId]);

  const { data: transactions = [] } = useQuery({
    queryKey: ['userTransactions', profileUser?.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: profileUser.id }),
    enabled: !!profileUser
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['userAchievements', profileUser?.id],
    queryFn: () => base44.entities.Achievement.filter({ user_id: profileUser.id }),
    enabled: !!profileUser
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['userRatings', profileUser?.id],
    queryFn: () => base44.entities.GameRating.filter({ user_id: profileUser.id }),
    enabled: !!profileUser
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['userConnections', profileUser?.id],
    queryFn: () => base44.entities.SocialConnection.filter({ user_id: profileUser.id }),
    enabled: !!profileUser
  });

  const { data: streak } = useQuery({
    queryKey: ['userStreak', profileUser?.id],
    queryFn: () => base44.entities.Streak.filter({ user_id: profileUser.id }).then(res => res[0]),
    enabled: !!profileUser
  });

  if (!profileUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isOwnProfile = user?.id === profileUser.id;
  const totalGames = transactions.filter(t => t.transaction_type === 'game_purchase').length;
  const unlockedAchievements = achievements.filter(a => a.is_unlocked).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <Avatar className="w-24 h-24 border-4 border-white">
                  <AvatarFallback className="text-3xl bg-white text-blue-600">
                    {profileUser.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold mb-2">{profileUser.full_name}</h1>
                  <p className="text-blue-100 mb-4">{profileUser.email}</p>
                  
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                      <Gamepad2 className="w-5 h-5" />
                      <span className="font-semibold">{totalGames} Games</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                      <Trophy className="w-5 h-5" />
                      <span className="font-semibold">{unlockedAchievements} Achievements</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                      <Star className="w-5 h-5" />
                      <span className="font-semibold">{ratings.length} Reviews</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                      <Users className="w-5 h-5" />
                      <span className="font-semibold">{connections.length} Friends</span>
                    </div>
                  </div>
                </div>

                {isOwnProfile && (
                  <Link to={createPageUrl('Settings')}>
                    <Button variant="secondary">
                      Edit Profile
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">${(profileUser.total_earnings || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-600">Total Earnings</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{profileUser.total_surveys_completed || 0}</p>
              <p className="text-sm text-gray-600">Surveys Completed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-orange-600" />
              <p className="text-2xl font-bold">{streak?.current_streak || 0}</p>
              <p className="text-sm text-gray-600">Day Streak</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold">{streak?.longest_streak || 0}</p>
              <p className="text-sm text-gray-600">Best Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="library" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="library">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Library
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="stats">
              <Target className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="friends">
              <Users className="w-4 h-4 mr-2" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Star className="w-4 h-4 mr-2" />
              Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            <GameLibrary userId={profileUser.id} transactions={transactions} />
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsDisplay achievements={achievements} />
          </TabsContent>

          <TabsContent value="stats">
            <UserStats 
              user={profileUser} 
              transactions={transactions}
              ratings={ratings}
              achievements={achievements}
            />
          </TabsContent>

          <TabsContent value="friends">
            <SocialConnections userId={profileUser.id} connections={connections} />
          </TabsContent>

          <TabsContent value="reviews">
            <UserReviews userId={profileUser.id} ratings={ratings} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}