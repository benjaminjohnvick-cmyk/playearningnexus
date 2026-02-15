import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Crown, MessageSquare, TrendingUp, Shield, Plus, Send, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import AIGuildChallenge from '../components/guilds/AIGuildChallenge';
import EnhancedGroupSpace from '../components/groups/EnhancedGroupSpace';

export default function GuildsPage() {
  const [user, setUser] = useState(null);
  const [newGuildData, setNewGuildData] = useState({ guild_name: '', description: '' });
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
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

  const { data: guilds = [] } = useQuery({
    queryKey: ['guilds'],
    queryFn: () => base44.entities.Guild.filter({ is_public: true }, '-total_earnings')
  });

  const { data: myGuilds = [] } = useQuery({
    queryKey: ['myGuilds', user?.id],
    queryFn: () => base44.entities.Guild.list().then(guilds => 
      guilds.filter(g => g.leader_id === user.id || g.member_ids?.includes(user.id))
    ),
    enabled: !!user
  });

  const { data: guildMembers = [] } = useQuery({
    queryKey: ['guildMembers', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.member_ids) return [];
      return await base44.entities.User.filter({ id: { $in: selectedGuild.member_ids } });
    },
    enabled: !!selectedGuild
  });

  const { data: guildMessages = [] } = useQuery({
    queryKey: ['guildMessages', selectedGuild?.id],
    queryFn: () => base44.entities.ChatMessage.filter({ 
      guild_id: selectedGuild.id 
    }, '-created_date', 50),
    enabled: !!selectedGuild,
    refetchInterval: 3000
  });

  const createGuildMutation = useMutation({
    mutationFn: async (guildData) => {
      return await base44.entities.Guild.create({
        ...guildData,
        leader_id: user.id,
        member_ids: [user.id],
        total_earnings: 0,
        guild_level: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guilds']);
      queryClient.invalidateQueries(['myGuilds']);
      toast.success('Guild created!');
      setNewGuildData({ guild_name: '', description: '' });
    }
  });

  const joinGuildMutation = useMutation({
    mutationFn: async (guild) => {
      const updatedMembers = [...(guild.member_ids || []), user.id];
      return await base44.entities.Guild.update(guild.id, {
        member_ids: updatedMembers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guilds']);
      queryClient.invalidateQueries(['myGuilds']);
      toast.success('Joined guild!');
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.ChatMessage.create({
        guild_id: selectedGuild.id,
        user_id: user.id,
        user_name: user.full_name,
        message: chatMessage,
        message_type: 'text'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guildMessages']);
      setChatMessage('');
    }
  });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent mb-2">
              Gaming Guilds
            </h1>
            <p className="text-gray-600">Join forces, compete together, earn together</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-green-600 to-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Guild
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Your Guild</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Guild Name</label>
                  <Input
                    placeholder="Enter guild name"
                    value={newGuildData.guild_name}
                    onChange={(e) => setNewGuildData({ ...newGuildData, guild_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    placeholder="What's your guild about?"
                    value={newGuildData.description}
                    onChange={(e) => setNewGuildData({ ...newGuildData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={() => createGuildMutation.mutate(newGuildData)}
                  disabled={!newGuildData.guild_name || createGuildMutation.isPending}
                  className="w-full"
                >
                  Create Guild
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="discover" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discover">
              <Shield className="w-4 h-4 mr-2" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="my-guilds">
              <Users className="w-4 h-4 mr-2" />
              My Guilds ({myGuilds.length})
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guilds.map((guild, index) => (
                <motion.div
                  key={guild.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {guild.guild_name}
                            {guild.leader_id === user.id && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">{guild.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Members</span>
                          <Badge variant="outline">
                            {guild.member_ids?.length || 0} / {guild.max_members}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Level</span>
                          <Badge>{guild.guild_level}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Total Earnings</span>
                          <span className="font-bold text-green-600">
                            ${(guild.total_earnings || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        {myGuilds.find(g => g.id === guild.id) ? (
                          <Button 
                            onClick={() => setSelectedGuild(guild)}
                            variant="outline" 
                            className="w-full"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Open Chat
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => joinGuildMutation.mutate(guild)}
                            disabled={guild.member_ids?.length >= guild.max_members}
                            className="w-full bg-gradient-to-r from-green-600 to-green-700"
                          >
                            Join Guild
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="my-guilds">
            {myGuilds.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">You haven't joined any guilds yet</p>
                <p className="text-sm text-gray-500">Join a guild to connect with other gamers!</p>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {myGuilds.map((guild) => (
                    <Card key={guild.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {guild.guild_name}
                          {guild.leader_id === user.id && (
                            <Badge className="bg-yellow-500">Leader</Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-gray-600">{guild.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Members</span>
                            <span className="font-medium">{guild.member_ids?.length || 0}</span>
                          </div>
                          <Button 
                            onClick={() => setSelectedGuild(guild)}
                            className="w-full"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Guild Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* AI Guild Challenges */}
                {myGuilds.length > 0 && myGuilds[0].leader_id === user.id && (
                  <AIGuildChallenge guild={myGuilds[0]} guildMembers={guildMembers} />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Top Guilds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {guilds
                    .sort((a, b) => (b.total_earnings || 0) - (a.total_earnings || 0))
                    .slice(0, 10)
                    .map((guild, index) => (
                      <div key={guild.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-400 w-8">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{guild.guild_name}</p>
                          <p className="text-sm text-gray-600">
                            {guild.member_ids?.length || 0} members • Level {guild.guild_level}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${(guild.total_earnings || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Total Earnings</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Enhanced Group Space Modal */}
        <Dialog open={!!selectedGuild} onOpenChange={() => setSelectedGuild(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <EnhancedGroupSpace group={selectedGuild} user={user} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}