import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, TrendingUp, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function GuildsPage() {
  const [user, setUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDescription, setGuildDescription] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: guilds = [] } = useQuery({
    queryKey: ['guilds'],
    queryFn: () => base44.entities.Guild.filter({ is_public: true }, '-total_earnings', 20)
  });

  const { data: myGuild } = useQuery({
    queryKey: ['myGuild', user?.id],
    queryFn: async () => {
      const allGuilds = await base44.entities.Guild.list();
      return allGuilds.find(g => 
        g.leader_id === user?.id || g.member_ids?.includes(user?.id)
      );
    },
    enabled: !!user
  });

  const createGuildMutation = useMutation({
    mutationFn: (data) => base44.entities.Guild.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['myGuild'] });
      setShowCreateForm(false);
      setGuildName('');
      setGuildDescription('');
      toast.success('Guild created!');
    }
  });

  const joinGuildMutation = useMutation({
    mutationFn: (guild) => {
      const newMembers = [...(guild.member_ids || []), user.id];
      return base44.entities.Guild.update(guild.id, { member_ids: newMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['myGuild'] });
      toast.success('Joined guild!');
    }
  });

  const handleCreateGuild = () => {
    if (!guildName.trim()) return;
    createGuildMutation.mutate({
      guild_name: guildName,
      description: guildDescription,
      leader_id: user.id,
      member_ids: [user.id],
      is_public: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-2">
              Guilds & Teams
            </h1>
            <p className="text-gray-600">Join a guild to compete together and earn bonuses</p>
          </div>
          {!myGuild && (
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Guild
            </Button>
          )}
        </div>

        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Create New Guild</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Guild Name"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                />
                <Textarea
                  placeholder="Guild Description"
                  value={guildDescription}
                  onChange={(e) => setGuildDescription(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button onClick={() => setShowCreateForm(false)} variant="outline">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateGuild}
                    disabled={createGuildMutation.isPending}
                    className="bg-gradient-to-r from-red-600 to-red-700"
                  >
                    Create Guild
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {myGuild && (
          <Card className="mb-8 border-2 border-red-400 bg-gradient-to-br from-red-50 to-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-600" />
                  My Guild: {myGuild.guild_name}
                </CardTitle>
                <Badge className="bg-red-600">Rank #{myGuild.rank || 'Unranked'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{myGuild.description}</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-red-600">{myGuild.member_ids?.length || 0}</p>
                  <p className="text-sm text-gray-600">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">${myGuild.total_earnings || 0}</p>
                  <p className="text-sm text-gray-600">Total Earnings</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">Level {myGuild.guild_level}</p>
                  <p className="text-sm text-gray-600">Guild Level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <h2 className="text-2xl font-bold mb-4">Discover Guilds</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guilds.map((guild, index) => {
            const isMember = myGuild?.id === guild.id;
            const isFull = (guild.member_ids?.length || 0) >= guild.max_members;

            return (
              <motion.div
                key={guild.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {guild.leader_id === user?.id && <Crown className="w-5 h-5 text-yellow-600" />}
                        <CardTitle className="text-lg">{guild.guild_name}</CardTitle>
                      </div>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{guild.description}</p>
                    <div className="flex items-center justify-between text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{guild.member_ids?.length || 0}/{guild.max_members}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span>${guild.total_earnings || 0}</span>
                      </div>
                    </div>
                    {isMember ? (
                      <Button disabled className="w-full" variant="outline">
                        Your Guild
                      </Button>
                    ) : myGuild ? (
                      <Button disabled className="w-full" variant="outline">
                        Already in a Guild
                      </Button>
                    ) : (
                      <Button
                        onClick={() => joinGuildMutation.mutate(guild)}
                        disabled={isFull || joinGuildMutation.isPending}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700"
                      >
                        {isFull ? 'Full' : 'Join Guild'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}