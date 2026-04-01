import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Zap, PauseCircle, SkipForward } from 'lucide-react';
import { motion } from 'framer-motion';

const POWER_UPS = [
  { id: 'stun', name: 'Stun', icon: Zap, cost: 0.50, duration: '3 sec' },
  { id: 'pause', name: 'Pause', icon: PauseCircle, cost: 0.50, duration: '5 sec' },
  { id: 'skip_turn', name: 'Skip Turn', icon: SkipForward, cost: 0.50, duration: '1 turn' }
];

export default function HeadToHeadContest() {
  const [user, setUser] = useState(null);
  const [activeContest, setActiveContest] = useState(null);
  const [groupSize, setGroupSize] = useState(5);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const { data: contests } = useQuery({
    queryKey: ['contests'],
    queryFn: () => base44.entities.HeadToHeadContest.filter({ status: 'waiting' }),
    enabled: !!user
  });

  const createContestMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('headToHeadContestMatchmaker', data),
    onSuccess: (res) => {
      setActiveContest(res.contest_id);
    }
  });

  const buyPowerUpMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('buyContestPowerUp', data)
  });

  const handleCreateContest = () => {
    createContestMutation.mutate({
      action: 'create',
      group_size: groupSize
    });
  };

  const handleAutoGroup = () => {
    createContestMutation.mutate({ action: 'auto_group' });
  };

  if (!user) return <div>Sign in to compete</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2">Head-to-Head Contests</h1>
          <p className="text-gray-300">Compete with others. Earn $3 first to win. Prize: $20+</p>
        </div>

        {!activeContest ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Contest Card */}
            <Card className="bg-gray-800 border-red-500/50 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Create Custom Contest</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300">Group Size: {groupSize}</label>
                  <input 
                    type="range" 
                    min="2" 
                    max="50" 
                    value={groupSize}
                    onChange={(e) => setGroupSize(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="text-sm text-gray-400">
                  <p>Entry Fee: ${2 * groupSize}</p>
                  <p>Prize Pool: $20</p>
                </div>
                <Button 
                  onClick={handleCreateContest}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700"
                >
                  Create Contest
                </Button>
              </div>
            </Card>

            {/* Auto Match Card */}
            <Card className="bg-gray-800 border-yellow-500/50 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Auto-Match</h2>
              <p className="text-gray-300 mb-4">AI selects optimal group size based on active users</p>
              <Button 
                onClick={handleAutoGroup}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600"
              >
                Find Competitors
              </Button>
            </Card>
          </div>
        ) : (
          <ContestInProgress contestId={activeContest} user={user} />
        )}
      </div>
    </div>
  );
}

function ContestInProgress({ contestId, user }) {
  const [contest, setContest] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      base44.entities.HeadToHeadContest.get(contestId).then(c => {
        setContest(c);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [contestId]);

  if (!contest) return <div>Loading...</div>;

  const userProgress = contest.participant_earnings?.[user.id] || 0;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="space-y-6"
    >
      <Card className="bg-gray-800 p-8 border-2 border-green-500">
        <h2 className="text-3xl font-bold text-white mb-6">Your Progress</h2>
        
        {/* Earnings Meter */}
        <div className="mb-6">
          <div className="flex justify-between text-white mb-2">
            <span>${userProgress.toFixed(2)}</span>
            <span className="text-yellow-400">$3 to Win</span>
          </div>
          <div className="w-full h-8 bg-gray-700 rounded-full overflow-hidden flex">
            <div className="w-1/3 bg-red-600" style={{ opacity: userProgress < 1 ? 1 : 0.5 }} />
            <div className="w-1/3 bg-yellow-500" style={{ opacity: userProgress >= 1 && userProgress < 2 ? 1 : 0.5 }} />
            <div className="w-1/3 bg-green-600" style={{ opacity: userProgress >= 2 ? 1 : 0.5 }} />
          </div>
        </div>

        {/* Power Ups */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-3">Power-Ups ($0.50 each)</h3>
          <div className="grid grid-cols-3 gap-3">
            {POWER_UPS.map(pu => (
              <Button 
                key={pu.id}
                className="bg-purple-600 hover:bg-purple-700 flex flex-col items-center gap-1"
              >
                <pu.icon className="w-4 h-4" />
                <span className="text-xs">{pu.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Competitors */}
        <div>
          <h3 className="text-lg font-bold text-white mb-3">Competitors</h3>
          <div className="space-y-2">
            {contest.participants?.map((pid, idx) => {
              const earnings = contest.participant_earnings?.[pid] || 0;
              const isWinner = earnings >= 3;
              return (
                <div key={pid} className={`p-2 rounded ${isWinner ? 'bg-green-600' : 'bg-gray-700'}`}>
                  <div className="flex justify-between text-white text-sm">
                    <span>{pid === user.id ? 'You' : `Player ${idx + 1}`}</span>
                    <span className="font-bold">${earnings.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}