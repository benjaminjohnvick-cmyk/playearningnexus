import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Image as ImageIcon, 
  Trophy, 
  DollarSign, 
  Settings, 
  Download,
  Share2,
  Calendar,
  Award,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import ImageGallery from '@/components/image/ImageGallery';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

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

  // Fetch generated images
  const { data: generatedImages = [] } = useQuery({
    queryKey: ['userGeneratedImages', user?.id],
    queryFn: () => base44.entities.GeneratedImage.filter({ user_id: user.id }),
    enabled: !!user
  });

  // Fetch contest history
  const { data: contestHistory = [] } = useQuery({
    queryKey: ['userContestHistory', user?.id],
    queryFn: () => base44.entities.ContestParticipation.filter({ user_id: user.id }),
    enabled: !!user
  });

  // Calculate statistics
  const totalContests = contestHistory.length;
  const completedContests = contestHistory.filter(c => c.part1_completed && c.part2_completed).length;
  const totalUsersReferred = contestHistory.reduce((sum, c) => sum + (c.users_referred || 0), 0);
  const totalBusinessesReferred = contestHistory.reduce((sum, c) => sum + (c.businesses_referred || 0), 0);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await base44.auth.updateMe({
        full_name: e.target.full_name.value,
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Profile Header */}
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-white">
                <AvatarFallback className="text-3xl bg-white text-blue-600">
                  {user.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold mb-2">{user.full_name}</h1>
                <p className="text-blue-100 mb-1">{user.email}</p>
                <p className="text-sm opacity-90">Member since {new Date(user.created_date).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                  <DollarSign className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-2xl font-bold">${(user.total_earnings || 0).toFixed(2)}</p>
                  <p className="text-xs opacity-90">Total Earnings</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                  <Trophy className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{completedContests}</p>
                  <p className="text-xs opacity-90">Contests Won</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="images" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="images">
              <ImageIcon className="w-4 h-4 mr-2" />
              My Images
            </TabsTrigger>
            <TabsTrigger value="contests">
              <Trophy className="w-4 h-4 mr-2" />
              Contests
            </TabsTrigger>
            <TabsTrigger value="earnings">
              <DollarSign className="w-4 h-4 mr-2" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* My Images Tab */}
          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Generated Images ({generatedImages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGallery images={generatedImages} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contests Tab */}
          <TabsContent value="contests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Contest History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <Award className="w-8 h-8 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold">{totalContests}</p>
                    <p className="text-sm text-gray-600">Total Contests</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <Trophy className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-2xl font-bold">{completedContests}</p>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                    <p className="text-2xl font-bold">{totalUsersReferred + totalBusinessesReferred}</p>
                    <p className="text-sm text-gray-600">Total Referrals</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {contestHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No contest history yet</p>
                  ) : (
                    contestHistory.map((contest) => (
                      <div key={contest.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-semibold">{new Date(contest.date).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-600">
                                {contest.part1_completed && contest.part2_completed ? (
                                  <span className="text-green-600">✓ Completed</span>
                                ) : contest.opted_out ? (
                                  <span className="text-yellow-600">⚠ Opted Out</span>
                                ) : (
                                  <span className="text-gray-500">⋯ In Progress</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Users: {contest.users_referred || 0}</p>
                            <p className="text-sm text-gray-600">Businesses: {contest.businesses_referred || 0}</p>
                            <p className="text-sm font-semibold text-green-600">
                              ${((contest.users_referred || 0) * 0.25 + (contest.businesses_referred || 0) * 0.50).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Earnings Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200">
                    <h3 className="font-semibold text-gray-700 mb-4">Current Balance</h3>
                    <p className="text-4xl font-bold text-green-600 mb-2">
                      ${(user.current_balance || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">Available for withdrawal</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
                    <h3 className="font-semibold text-gray-700 mb-4">Total Earnings</h3>
                    <p className="text-4xl font-bold text-blue-600 mb-2">
                      ${(user.total_earnings || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">All-time earnings</p>
                  </div>
                </div>

                <div className="mt-6 bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Referral Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Users Referred</p>
                      <p className="text-2xl font-bold text-purple-600">{totalUsersReferred}</p>
                      <p className="text-xs text-green-600">${(totalUsersReferred * 0.25).toFixed(2)} earned</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Businesses Referred</p>
                      <p className="text-2xl font-bold text-purple-600">{totalBusinessesReferred}</p>
                      <p className="text-xs text-green-600">${(totalBusinessesReferred * 0.50).toFixed(2)} earned</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        name="full_name"
                        defaultValue={user.full_name}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user.email}
                        disabled
                        className="bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit">Save Changes</Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>Full Name</Label>
                      <p className="text-lg font-medium mt-1">{user.full_name}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="text-lg font-medium mt-1">{user.email}</p>
                    </div>
                    <div>
                      <Label>Account Type</Label>
                      <p className="text-lg font-medium mt-1 capitalize">{user.role || 'User'}</p>
                    </div>
                    <Button onClick={() => setIsEditing(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}