import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SquadCreate from '@/components/squads/SquadCreate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Trophy, Activity } from 'lucide-react';

export default function ReferralSquadsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createdSquad, setCreatedSquad] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const { data: mySquads = [] } = useQuery({
    queryKey: ['mySquads', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const squads = await base44.entities.ReferralSquad.filter({
        member_ids: { $in: [user.id] },
      });
      return squads;
    },
    enabled: !!user,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['squadLeaderboard'],
    queryFn: async () => {
      const squads = await base44.entities.ReferralSquad.filter({ status: 'active' });
      return squads.sort((a, b) => b.total_active_referrals - a.total_active_referrals).slice(0, 10);
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Create Squad
          </TabsTrigger>
          <TabsTrigger value="my-squads" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            My Squads
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <SquadCreate onSquadCreated={setCreatedSquad} />
        </TabsContent>

        <TabsContent value="my-squads" className="mt-6">
          <div className="grid gap-4">
            {mySquads.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  No squads yet. Create one to get started!
                </CardContent>
              </Card>
            ) : (
              mySquads.map((squad) => (
                <Card key={squad.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{squad.squad_name}</CardTitle>
                        <p className="text-xs text-gray-600 mt-1">{squad.description}</p>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700">Code: {squad.squad_code}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-600">Members</p>
                        <p className="text-2xl font-bold">{squad.member_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Referrals</p>
                        <p className="text-2xl font-bold text-green-600">{squad.total_referrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Active Referrals</p>
                        <p className="text-2xl font-bold text-blue-600">{squad.total_active_referrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Prize Pool Points</p>
                        <p className="text-2xl font-bold text-purple-600">{squad.total_jackpot_entries}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Squad Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map((squad, idx) => (
                  <div key={squad.id} className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-indigo-600">#{idx + 1}</span>
                      <div>
                        <p className="font-semibold">{squad.squad_name}</p>
                        <p className="text-xs text-gray-600">{squad.member_count} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{squad.total_active_referrals} active</p>
                      <p className="text-xs text-gray-600">{squad.total_jackpot_entries} entries</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}