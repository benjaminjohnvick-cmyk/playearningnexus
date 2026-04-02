import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Circle, DollarSign, Users, Zap, Download, Star, Trophy,
  MessageSquare, ShoppingCart, Loader2, RefreshCw, Lock, Share2, Gamepad2, Search, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

// ── Ordered mandatory tasks: Task 1 → PPC Ads $0.40, Task 2 → Shop Search, Task 3 → Surveys $3 ──
const CORE_TASKS = [
  {
    id: 'ppc_earn_40',
    order: 1,
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
    title: 'Task 1 — Earn $0.40 from PPC Ads',
    description: 'Interact with the Paid PPC Ads / Mosaic page and earn $0.40 today.',
    action: { label: 'Go to PPC Ads', path: 'PaidPPCAdsMosaic' },
    points: 15,
  },
  {
    id: 'shop_search',
    order: 2,
    icon: Search,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-600',
    title: 'Task 2 — Daily Shop Search (−$0.05)',
    description: 'Use the Shop button on the GamerGain search widget to search for 1 product. $0.05 is auto-deducted. The product is added to your Wishlist, and you receive contest entries automatically.',
    action: { label: 'Open Store & Search', path: 'InAppGameStore' },
    points: 10,
    note: '−$0.05 + contest entries awarded',
  },
  {
    id: 'earn_3_surveys',
    order: 3,
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    badgeBg: 'bg-green-600',
    title: 'Task 3 — Earn $3 via Surveys',
    description: 'Complete surveys to hit your daily $3 earnings goal.',
    action: { label: 'Take Surveys', path: 'Surveys' },
    points: 30,
  },
];

// Additional mandatory earn-section tasks (after core 3)
const EXTRA_MANDATORY_TASKS = [
  {
    id: 'play_new_game',
    icon: Gamepad2,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-600',
    title: 'Play a New Game',
    description: 'Browse the Game Store and play a game you haven\'t tried yet. It\'ll be added to your wishlist.',
    action: { label: 'Browse Games', path: 'InAppGameStore' },
    points: 20,
  },
  {
    id: 'referral',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-600',
    title: 'Make a Referral',
    description: 'Share your referral link and invite at least one new user today.',
    action: { label: 'Refer Friends', path: 'ReferralDashboard' },
    points: 20,
  },
  {
    id: 'download_widget',
    icon: Download,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    badgeBg: 'bg-orange-600',
    title: 'Download the GamerGain Search Widget',
    description: 'Install the GamerGain search widget for automatic ad earnings and contest entries.',
    action: { label: 'Download Widget', path: 'PPCMarketplace' },
    points: 10,
  },
  {
    id: 'social_connect',
    icon: Share2,
    color: 'text-pink-600',
    bg: 'bg-pink-50 border-pink-200',
    badgeBg: 'bg-pink-600',
    title: 'Connect Social Media',
    description: 'Link Facebook, Instagram, Twitter, Snapchat, TikTok, or YouTube to enable auto-posting.',
    action: { label: 'Connect Now', path: 'SocialMediaSetup' },
    points: 30,
  },
  {
    id: 'ppc_marketplace',
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
    title: 'Browse PPC Marketplace',
    description: 'Explore the PPC Marketplace for additional earning opportunities.',
    action: { label: 'View PPC', path: 'PPCMarketplace' },
    points: 10,
  },
  {
    id: 'check_wishlist',
    icon: ShoppingCart,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
    badgeBg: 'bg-rose-600',
    title: 'Review Your Wishlist',
    description: 'Check items automatically added to your wishlist from your searches and clicks.',
    action: { label: 'View Wishlist', path: 'Wishlist' },
    points: 5,
  },
  {
    id: 'referral_contest',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-600',
    title: 'Check Referral Contest',
    description: 'View your contest entries and current ranking for the GamerGain jackpot.',
    action: { label: 'View Contest', path: 'ReferralContest' },
    points: 5,
  },
];

const ALL_MANDATORY = [...CORE_TASKS, ...EXTRA_MANDATORY_TASKS];

export default function DailyTodoList() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [aiTasks, setAiTasks] = useState([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const autoStarted = useRef(false);

  const todayKey = (uid) => `todo_completed_${uid}_${new Date().toDateString()}`;

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const saved = JSON.parse(localStorage.getItem(todayKey(u.id)) || '[]');
      setCompletedTasks(saved);
      loadAITasks(u);
      // Auto-navigate to first incomplete core task
      if (!autoStarted.current) {
        autoStarted.current = true;
        const firstPending = CORE_TASKS.find(t => !saved.includes(t.id));
        if (firstPending) {
          setCurrentTaskId(firstPending.id);
          setTimeout(() => {
            toast.info(`▶ Starting: ${firstPending.title}`, { duration: 3000 });
            navigate(createPageUrl(firstPending.action.path));
          }, 1200);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pts = ALL_MANDATORY.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + t.points, 0)
      + aiTasks.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + (t.points || 10), 0);
    setTotalPoints(pts);
  }, [completedTasks, aiTasks]);

  // After Task 2 (shop_search) is done → deduct $0.05 and award contest entries
  useEffect(() => {
    if (!user) return;
    if (completedTasks.includes('shop_search') && !localStorage.getItem(`shop_fee_${todayKey(user.id)}`)) {
      localStorage.setItem(`shop_fee_${todayKey(user.id)}`, '1');
      const newBalance = Math.max(0, (user.current_balance || 0) - 0.05);
      base44.auth.updateMe({
        current_balance: newBalance,
        total_jackpot_entries: (user.total_jackpot_entries || 0) + 1,
      }).catch(() => {});
      toast.success('🏆 Contest entry awarded! $0.05 deducted from earnings.');
    }
  }, [completedTasks, user]);

  const markComplete = (taskId) => {
    if (!user || completedTasks.includes(taskId)) return;
    const updated = [...completedTasks, taskId];
    setCompletedTasks(updated);
    localStorage.setItem(todayKey(user.id), JSON.stringify(updated));
    toast.success('✅ Task complete! Points earned!');
    // Auto-advance to next incomplete task
    const allTasks = [...ALL_MANDATORY, ...aiTasks];
    const nextTask = allTasks.find(t => !updated.includes(t.id));
    if (nextTask) {
      setCurrentTaskId(nextTask.id);
      setTimeout(() => {
        toast.info(`▶ Next: ${nextTask.title}`, { duration: 2500 });
      }, 500);
    } else {
      setCurrentTaskId(null);
      toast.success('🎉 All daily tasks completed!', { duration: 4000 });
    }
  };

  const toggleTask = (taskId) => {
    if (!user) return;
    if (completedTasks.includes(taskId)) {
      const updated = completedTasks.filter(t => t !== taskId);
      setCompletedTasks(updated);
      localStorage.setItem(todayKey(user.id), JSON.stringify(updated));
    } else {
      markComplete(taskId);
    }
  };

  const handleGoToTask = (task) => {
    markComplete(task.id);
    navigate(createPageUrl(task.action.path));
  };

  const loadAITasks = async (u) => {
    setLoadingAi(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 personalized daily earn-section tasks for GamerGain user ${u?.full_name || 'User'} (earnings: $${(u?.total_earnings || 0).toFixed(2)}).
Available pages: Surveys, PPCMarketplace, InAppGameStore, ReferralDashboard, Tournaments, Guilds, AchievementsPage, DailyEarningStreak, GlobalLeaderboard, Wishlist, Withdrawal, RewardsMarketplace, ReferralContest, CreatorDashboard, ExploreSurveys.
Tasks should focus on earning activities. Return JSON array: id, title, description, icon_name (lucide icon name), path, points (5-25).`,
        response_json_schema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  icon_name: { type: 'string' },
                  path: { type: 'string' },
                  points: { type: 'number' },
                }
              }
            }
          }
        }
      });
      setAiTasks(res.tasks || []);
    } catch {
      setAiTasks([
        { id: 'streak', title: 'Maintain Daily Streak', description: 'Log in and complete at least one activity', icon_name: 'Star', path: 'DailyEarningStreak', points: 15 },
        { id: 'leaderboard', title: 'Check Leaderboard', description: 'See your rank and compete for top positions', icon_name: 'Trophy', path: 'GlobalLeaderboard', points: 5 },
        { id: 'guild', title: 'Participate in Guild', description: 'Complete a guild challenge or contribute points', icon_name: 'Users', path: 'Guilds', points: 15 },
        { id: 'explore_surveys', title: 'Explore New Surveys', description: 'Browse available surveys and find high-paying ones', icon_name: 'DollarSign', path: 'ExploreSurveys', points: 10 },
        { id: 'achievements', title: 'Check Achievements', description: 'See what badges you can unlock today', icon_name: 'Star', path: 'AchievementsPage', points: 5 },
      ]);
    }
    setLoadingAi(false);
  };

  const allCoreDone = CORE_TASKS.every(t => completedTasks.includes(t.id));
  const allMandatoryDone = ALL_MANDATORY.every(t => completedTasks.includes(t.id));
  const totalTasks = ALL_MANDATORY.length + aiTasks.length;
  const completedCount = completedTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const getIcon = (name) => {
    const icons = { Star, Trophy, Users, Zap, DollarSign, ShoppingCart, MessageSquare, Download, Gamepad2, Search, Share2, ArrowRight };
    return icons[name] || Star;
  };

  const renderTaskCard = (task, idx, isCore = false) => {
    const done = completedTasks.includes(task.id);
    const isActive = currentTaskId === task.id && !done;
    const Icon = task.icon || getIcon(task.icon_name);
    return (
      <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
        <Card className={`border-2 transition-all ${done ? 'border-green-400 bg-green-50' : isActive ? 'border-indigo-400 bg-indigo-50 shadow-lg ring-2 ring-indigo-300' : (task.bg || 'bg-white border-gray-200')}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
              {done ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />}
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-200' : 'bg-white shadow'}`}>
              <Icon className={`w-5 h-5 ${done ? 'text-green-600' : (task.color || 'text-gray-600')}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                {isActive && <Badge className="bg-indigo-600 text-white text-xs animate-pulse">▶ Now</Badge>}
                {task.note && !done && <Badge className="bg-amber-100 text-amber-700 text-xs">{task.note}</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`${task.badgeBg || 'bg-gray-500'} text-white text-xs`}>+{task.points}pts</Badge>
              {!done && (
                <Button size="sm" onClick={() => handleGoToTask(task)} className="text-xs h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  Go <ArrowRight className="w-3 h-3 ml-0.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">📋 Daily To-Do List</h1>
            <Badge className="bg-purple-600 text-white">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Badge>
          </div>
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{completedCount}/{totalTasks} tasks completed</p>
                <p className="text-sm font-bold">{totalPoints} pts earned</p>
              </div>
              <div className="w-full bg-white/30 rounded-full h-3">
                <motion.div className="bg-white rounded-full h-3" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6 }} />
              </div>
              {allMandatoryDone && <p className="text-xs mt-2 text-yellow-200">🎉 All mandatory tasks done! Great work today!</p>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Auto-flow note */}
        <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800">
          <strong>📌 Auto-Flow:</strong> You're automatically guided through tasks in order. Complete Task 1 (PPC Ads $0.40) → Task 2 (Shop Search, −$0.05, contest entries awarded) → Task 3 (Surveys $3) → then all remaining tasks automatically.
        </div>

        {/* CORE 3 TASKS */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-gray-900">Core Daily Tasks</h2>
            <Badge className="bg-red-500 text-white text-xs">Auto-guided · Complete in order</Badge>
          </div>
          <div className="space-y-3">
            {CORE_TASKS.map((task, i) => renderTaskCard(task, i, true))}
          </div>
        </div>

        {/* REMAINING MANDATORY TASKS */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-orange-500" />
            <h2 className="font-bold text-gray-900">Earn Section Tasks</h2>
            <Badge className="bg-orange-500 text-white text-xs">Mandatory Daily</Badge>
          </div>
          <div className="space-y-3">
            {EXTRA_MANDATORY_TASKS.map((task, i) => renderTaskCard(task, i))}
          </div>
        </div>

        {/* AI / PERSONALIZED TASKS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <h2 className="font-bold text-gray-900">Personalized Earn Tasks</h2>
              <Badge className="bg-purple-500 text-white text-xs">AI-Generated</Badge>
            </div>
            <Button size="sm" variant="ghost" onClick={() => user && loadAITasks(user)} disabled={loadingAi} className="text-xs">
              {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>

          {loadingAi ? (
            <Card><CardContent className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" /><p className="text-sm text-gray-500">Generating tasks…</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {aiTasks.map((task, i) => {
                  const done = completedTasks.includes(task.id);
                  const isActive = currentTaskId === task.id && !done;
                  const Icon = getIcon(task.icon_name);
                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className={`border transition-all ${done ? 'border-green-300 bg-green-50' : isActive ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
                            {done ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />}
                          </button>
                          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                              {isActive && <Badge className="bg-indigo-600 text-white text-xs animate-pulse">▶ Now</Badge>}
                            </div>
                            <p className="text-xs text-gray-500">{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className="bg-purple-100 text-purple-700 text-xs">+{task.points || 10}pts</Badge>
                            {!done && task.path && (
                              <Button size="sm" onClick={() => handleGoToTask(task)} className="text-xs h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                Go <ArrowRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}