import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Gamepad2, Users, Star, CheckCircle2, Clock, Gift, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const QUESTS = [
  {
    id: 'play_3_games',
    icon: '🎮',
    title: 'Game Explorer',
    description: 'Play 3 different games today',
    reward: 0.75,
    total: 3,
    category: 'gaming',
    color: 'from-blue-50 to-indigo-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'refer_1_friend',
    icon: '👥',
    title: 'Social Connector',
    description: 'Refer 1 friend who signs up',
    reward: 2.00,
    total: 1,
    category: 'social',
    color: 'from-purple-50 to-pink-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'complete_2_surveys',
    icon: '📋',
    title: 'Survey Champion',
    description: 'Complete 2 surveys today',
    reward: 1.50,
    total: 2,
    category: 'surveys',
    color: 'from-green-50 to-emerald-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  {
    id: 'earn_3_dollars',
    icon: '💰',
    title: 'Daily Earner',
    description: 'Earn $3.00 today',
    reward: 0.50,
    total: 300,
    unit: 'cents',
    category: 'earning',
    color: 'from-yellow-50 to-orange-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  {
    id: 'visit_store',
    icon: '🛍️',
    title: 'Window Shopper',
    description: 'Visit the Game Store and browse 5 games',
    reward: 0.25,
    total: 5,
    category: 'gaming',
    color: 'from-red-50 to-rose-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  {
    id: 'login_streak',
    icon: '🔥',
    title: 'Streak Keeper',
    description: 'Log in for 3 consecutive days',
    reward: 1.00,
    total: 3,
    category: 'engagement',
    color: 'from-orange-50 to-amber-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
];

const categoryColors = {
  gaming: 'bg-blue-100 text-blue-700',
  social: 'bg-purple-100 text-purple-700',
  surveys: 'bg-green-100 text-green-700',
  earning: 'bg-yellow-100 text-yellow-700',
  engagement: 'bg-orange-100 text-orange-700',
};

export default function Quests() {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [claimed, setClaimed] = useState(new Set());
  const [totalEarned, setTotalEarned] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        // Load saved progress from localStorage keyed by date
        const today = new Date().toDateString();
        const saved = JSON.parse(localStorage.getItem(`quests_${today}`) || '{}');
        const claimedSaved = JSON.parse(localStorage.getItem(`quests_claimed_${today}`) || '[]');
        setProgress(saved);
        setClaimed(new Set(claimedSaved));
        const earned = claimedSaved.reduce((sum, id) => {
          const q = QUESTS.find(q => q.id === id);
          return sum + (q?.reward || 0);
        }, 0);
        setTotalEarned(earned);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveProgress = (newProgress, newClaimed) => {
    const today = new Date().toDateString();
    localStorage.setItem(`quests_${today}`, JSON.stringify(newProgress));
    localStorage.setItem(`quests_claimed_${today}`, JSON.stringify([...newClaimed]));
  };

  const addProgress = (questId) => {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest || claimed.has(questId)) return;
    const current = progress[questId] || 0;
    if (current >= quest.total) return;
    const newProgress = { ...progress, [questId]: current + 1 };
    setProgress(newProgress);
    saveProgress(newProgress, claimed);
  };

  const claimReward = async (questId) => {
    if (claimed.has(questId)) return;
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest) return;
    const newClaimed = new Set([...claimed, questId]);
    setClaimed(newClaimed);
    setTotalEarned(prev => prev + quest.reward);
    saveProgress(progress, newClaimed);
    // Record transaction
    try {
      await base44.entities.Transaction.create({
        user_id: user?.id,
        amount: quest.reward,
        type: 'quest_reward',
        description: `Quest Completed: ${quest.title}`,
        status: 'completed',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filter === 'all' ? QUESTS : QUESTS.filter(q => q.category === filter);
  const completedCount = QUESTS.filter(q => (progress[q.id] || 0) >= q.total).length;
  const totalRewards = QUESTS.reduce((s, q) => s + q.reward, 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daily Quests</h1>
              <p className="text-gray-500 text-sm">Complete challenges, earn bonus rewards</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">Resets in</p>
              <p className="text-sm font-bold text-red-600">
                {(() => {
                  const now = new Date();
                  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
                  const h = Math.floor((midnight - now) / 3600000);
                  const m = Math.floor(((midnight - now) % 3600000) / 60000);
                  return `${h}h ${m}m`;
                })()}
              </p>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-green-700">{completedCount}/{QUESTS.length}</p>
                <p className="text-xs text-green-600">Completed</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-yellow-700">${totalEarned.toFixed(2)}</p>
                <p className="text-xs text-yellow-600">Earned Today</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-purple-700">${totalRewards.toFixed(2)}</p>
                <p className="text-xs text-purple-600">Max Available</p>
              </CardContent>
            </Card>
          </div>

          {/* Overall Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Daily Progress</span>
              <span>{completedCount} of {QUESTS.length} quests</span>
            </div>
            <Progress value={(completedCount / QUESTS.length) * 100} className="h-3" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {['all', 'gaming', 'social', 'surveys', 'earning', 'engagement'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === f ? 'bg-red-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Quest Cards */}
        <div className="grid gap-4">
          {filtered.map(quest => {
            const current = progress[quest.id] || 0;
            const isComplete = current >= quest.total;
            const isClaimed = claimed.has(quest.id);
            const pct = Math.min((current / quest.total) * 100, 100);

            return (
              <Card key={quest.id} className={`bg-gradient-to-r ${quest.color} border ${quest.border} transition-all ${isClaimed ? 'opacity-70' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{quest.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-sm">{quest.title}</h3>
                        <Badge className={`text-xs ${categoryColors[quest.category]}`}>{quest.category}</Badge>
                        {isClaimed && <Badge className="bg-green-100 text-green-700 text-xs">✓ Claimed</Badge>}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{quest.description}</p>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{quest.unit === 'cents' ? `$${(current / 100).toFixed(2)} / $${(quest.total / 100).toFixed(2)}` : `${current} / ${quest.total}`}</span>
                          <span className="font-semibold text-green-700">+${quest.reward.toFixed(2)} reward</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {isClaimed ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : isComplete ? (
                        <Button
                          size="sm"
                          onClick={() => claimReward(quest.id)}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs px-3 py-1.5 h-auto"
                        >
                          <Gift className="w-3.5 h-3.5 mr-1" /> Claim
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addProgress(quest.id)}
                          className="text-xs px-3 py-1.5 h-auto border-gray-300"
                        >
                          +1 Progress
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Completion Banner */}
        {completedCount === QUESTS.length && (
          <Card className="mt-6 bg-gradient-to-r from-yellow-400 to-orange-500 border-0 text-white">
            <CardContent className="p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-2 text-white" />
              <h3 className="text-xl font-bold">All Quests Complete!</h3>
              <p className="text-sm opacity-90 mt-1">You've earned ${totalEarned.toFixed(2)} in bonus rewards today. Come back tomorrow for new quests!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}