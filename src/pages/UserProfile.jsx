import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Trophy, Gamepad2, Star, Users, MessageSquare, Calendar, Target, Coins, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GameLibrary from '../components/profile/GameLibrary';
import AchievementsDisplay from '../components/profile/AchievementsDisplay';
import UserStats from '../components/profile/UserStats';
import SocialConnections from '../components/profile/SocialConnections';
import UserReviews from '../components/profile/UserReviews';
import CurrentActivity from '../components/profile/CurrentActivity';
import GuildActivity from '../components/profile/GuildActivity';
import FavoriteGames from '../components/profile/FavoriteGames';
import EnhancedProfileHeader from '../components/profile/EnhancedProfileHeader';
import RecentlyPlayedGames from '../components/profile/RecentlyPlayedGames';
import WishlistDisplay from '../components/profile/WishlistDisplay';
import FriendEndorsements from '../components/profile/FriendEndorsements';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ bio: '', avatar_url: '' });
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
        setEditData({
          bio: currentUser.bio || '',
          avatar_url: currentUser.avatar_url || ''
        });
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUsers();
  }, [userId]);

  const handleSaveProfile = async () => {
    try {
      await base44.auth.updateMe(editData);
      const updatedUser = await base44.auth.me();
      setProfileUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile', error);
    }
  };

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

  // Top badges for header
  const topBadges = achievements
    .filter(a => a.is_unlocked)
    .sort((a, b) => (b.points_awarded || 0) - (a.points_awarded || 0))
    .slice(0, 3)
    .map(a => ({
      name: a.title,
      icon: Trophy
    }));

  const stats = {
    achievements: unlockedAchievements,
    totalPoints: profileUser.gamification_points || 0,
    streak: streak?.current_streak || 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Profile Header */}
        <EnhancedProfileHeader
          user={user}
          profileUser={profileUser}
          isOwnProfile={isOwnProfile}
          stats={stats}
          topBadges={topBadges}
        />

        {/* Edit Profile Form */}
        {isEditing && isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Avatar URL</label>
                  <Input
                    placeholder="https://example.com/avatar.jpg"
                    value={editData.avatar_url}
                    onChange={(e) => setEditData({ ...editData, avatar_url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Bio</label>
                  <Textarea
                    placeholder="Tell us about yourself..."
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button onClick={handleSaveProfile}>
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Overview */}
        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">${(profileUser.total_earnings || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-600">Total Earnings</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Coins className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold">{(profileUser.virtual_currency || 0).toFixed(0)}</p>
              <p className="text-sm text-gray-600">Credits Balance</p>
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

        {/* Activity, Recently Played & Wishlist Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <CurrentActivity userId={profileUser.id} />
          <RecentlyPlayedGames userId={profileUser.id} />
          <WishlistDisplay userId={profileUser.id} isOwnProfile={isOwnProfile} />
        </div>

        {/* Favorites & Endorsements */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            <FavoriteGames userId={profileUser.id} isOwnProfile={isOwnProfile} />
          </div>
          <FriendEndorsements 
            profileUserId={profileUser.id} 
            currentUserId={user?.id}
            isOwnProfile={isOwnProfile}
          />
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="library" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
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
            <TabsTrigger value="transactions">
              <DollarSign className="w-4 h-4 mr-2" />
              Transactions
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

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-semibold capitalize">{transaction.transaction_type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(transaction.created_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.currency === 'CREDITS' ? `${transaction.amount} Credits` : `$${transaction.amount.toFixed(2)}`}
                          </p>
                          <p className="text-sm text-gray-600">{transaction.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}