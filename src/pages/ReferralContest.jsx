import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Trophy, LinkIcon, TrendingUp, Share2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReferralContestPage() {
  const [user, setUser] = useState(null);
  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingContest, setCreatingContest] = useState(false);
  const [contestName, setContestName] = useState('');
  const [template, setTemplate] = useState('default');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);

        const userContests = await base44.asServiceRole.entities.ReferralContest.filter({
          creator_user_id: me.id
        });
        setContests(userContests);
        if (userContests.length > 0) {
          setSelectedContest(userContests[0]);
          loadLeaderboard(userContests[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadLeaderboard = async (contestId) => {
    try {
      const response = await base44.functions.invoke('referralContestLeaderboard', {
        action: 'getWeeklyLeaderboard',
        contestId
      });
      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    }
  };

  const handleCreateContest = async () => {
    if (!contestName.trim()) {
      toast.error('Please enter a contest name');
      return;
    }

    setCreatingContest(true);
    try {
      const inviteCode = Math.random().toString(36).substr(2, 9).toUpperCase();
      const inviteLink = `${window.location.origin}/referral/${inviteCode}`;

      const newContest = await base44.asServiceRole.entities.ReferralContest.create({
        creator_user_id: user.id,
        contest_name: contestName,
        custom_landing_page_template: template,
        invite_link: inviteLink,
        custom_landing_page_url: `/referral-landing/${inviteCode}`,
        week_start: new Date().toISOString().split('T')[0],
        week_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      setContests([...contests, newContest]);
      setSelectedContest(newContest);
      setContestName('');
      toast.success('Contest created! Share your invite link.');
    } catch (e) {
      toast.error('Failed to create contest: ' + e.message);
    } finally {
      setCreatingContest(false);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 mb-8 flex items-center gap-3">
          <Trophy className="w-10 h-10 text-yellow-500" /> Referral Prize Pools
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Create Contest Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 border-purple-200 h-full">
              <CardHeader>
                <CardTitle className="text-lg">Create New Contest</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Contest name"
                  value={contestName}
                  onChange={(e) => setContestName(e.target.value)}
                />
                <select 
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="default">Default Template</option>
                  <option value="minimal">Minimal</option>
                  <option value="gaming">Gaming</option>
                  <option value="premium">Premium</option>
                </select>
                <Button
                  onClick={handleCreateContest}
                  disabled={creatingContest}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {creatingContest ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Contest'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Your Contests */}
          {contests.map((contest, idx) => (
            <motion.div key={contest.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
              <Card 
                className={`border-2 cursor-pointer transition-all ${selectedContest?.id === contest.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => { setSelectedContest(contest); loadLeaderboard(contest.id); }}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{contest.contest_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-bold">Referrals:</span> {contest.total_referrals}</p>
                    <p><span className="font-bold">Conversions:</span> {contest.conversions}</p>
                    <p><span className="font-bold">Prize Pool:</span> ${contest.prize_pool?.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Selected Contest Details */}
        {selectedContest && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Share Section */}
            <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" /> Share Your Invite Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={selectedContest.invite_link}
                    readOnly
                    className="bg-white"
                  />
                  <Button
                    onClick={() => copyLink(selectedContest.invite_link)}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Every new signup through your link counts as a referral. Track conversions in real-time!
                </p>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Tabs defaultValue="leaderboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="leaderboard">Weekly Leaderboard</TabsTrigger>
                <TabsTrigger value="settings">Contest Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" /> Top 10 Referrers This Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {leaderboard.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No referrals yet. Share your link to get started!</p>
                    ) : (
                      <div className="space-y-3">
                        {leaderboard.map((entry, idx) => (
                          <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                            <div className={`flex items-center gap-4 p-4 rounded-lg border-2 ${idx < 3 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="text-2xl font-black w-12 text-center">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-gray-900">User {entry.user_id.slice(0, 8)}</p>
                                <p className="text-sm text-gray-600">{entry.referrals} referrals · {entry.conversions} conversions</p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-lg text-green-600">${entry.earnings?.toFixed(2)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Contest Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Landing Page Template</p>
                      <Badge className="bg-purple-600">{selectedContest.custom_landing_page_template}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Week Duration</p>
                      <p className="text-sm text-gray-600">{selectedContest.week_start} to {selectedContest.week_end}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Prize Pool</p>
                      <p className="text-lg font-black text-green-600">${selectedContest.prize_pool?.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </div>
  );
}