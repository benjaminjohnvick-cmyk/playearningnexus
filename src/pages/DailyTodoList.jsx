import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, DollarSign, Users, Zap, Download, Star, Trophy, MessageSquare, ShoppingCart, Loader2, RefreshCw, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const MANDATORY_TASKS = [
  {
    id: 'earn_3',
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    badgeBg: 'bg-green-600',
    title: 'Earn $3 Today',
    description: 'Complete surveys or engage with PPC ads to hit your daily $3 goal',
    action: { label: 'Take Surveys', path: 'Surveys' },
    mandatory: true,
    points: 30,
  },
  {
    id: 'referral',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-600',
    title: 'Make a Referral',
    description: 'Share your referral link and invite at least one new user today',
    action: { label: 'Refer Friends', path: 'ReferralDashboard' },
    mandatory: true,
    points: 20,
  },
  {
    id: 'ppc',
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
    title: 'Use PPC Search Widget',
    description: 'Search and click at least 3 PPC ads using the widget',
    action: { label: 'Open Widget', path: 'PPCMarketplace' },
    mandatory: true,
    points: 15,
  },
  {
    id: 'download_extension',
    icon: Download,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    badgeBg: 'bg-orange-600',
    title: 'Download the PPC Widget',
    description: 'Install the GainerGain browser extension for automatic ad earnings',
    action: { label: 'Download', path: 'PPCMarketplace' },
    mandatory: true,
    points: 10,
  },
];

export default function DailyTodoList() {
  const [user, setUser] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [aiTasks, setAiTasks] = useState([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Load today's completed tasks from localStorage
      const key = `todo_completed_${u.id}_${new Date().toDateString()}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setCompletedTasks(saved);
      // Load AI tasks
      loadAITasks(u);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const mandatory = MANDATORY_TASKS.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + t.points, 0);
    const ai = aiTasks.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + (t.points || 10), 0);
    setTotalPoints(mandatory + ai);
  }, [completedTasks, aiTasks]);

  const loadAITasks = async (u) => {
    setLoadingAi(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a personalized daily to-do list for a GamerGain user.
        
User stats:
- Total earnings: $${(u?.total_earnings || 0).toFixed(2)}
- Jackpot entries: ${u?.total_jackpot_entries || 0}
- Name: ${u?.full_name || 'User'}

Available platform features: Surveys, PPC Marketplace, Game Store, Referral Dashboard, 
Tournaments, Guilds, Creator Hub, Achievements, Daily Streak, Leaderboard, Wishlist, 
Withdrawal, Profile Settings, Notification Settings, Rewards Marketplace, Referral Contest.

Generate 6 additional personalized tasks (beyond earning $3, referrals, and PPC widget use) 
that would benefit this user today. Make them specific, actionable, and tied to platform features.

Return JSON array of tasks with fields: id, title, description, icon_name (lucide icon), path (page name), points (5-25).`,
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
    } catch (e) {
      // Fallback tasks
      setAiTasks([
        { id: 'streak', title: 'Maintain Daily Streak', description: 'Log in and complete at least one activity', icon_name: 'Star', path: 'DailyEarningStreak', points: 15 },
        { id: 'leaderboard', title: 'Check Leaderboard', description: 'See your rank and compete for top positions', icon_name: 'Trophy', path: 'GlobalLeaderboard', points: 5 },
        { id: 'survey_share', title: 'Share a Survey', description: 'Share a survey link with someone who might be interested', icon_name: 'Share2', path: 'ExploreSurveys', points: 10 },
        { id: 'social_connect', title: 'Connect Social Media', description: 'Link Facebook, Instagram, Twitter, or Snapchat for auto-posts', icon_name: 'Users', path: 'SocialMediaSetup', points: 20 },
        { id: 'wishlist', title: 'Add to Wishlist', description: 'Browse the store and add 3 items to your wishlist', icon_name: 'Star', path: 'Wishlist', points: 5 },
        { id: 'guild', title: 'Participate in Guild', description: 'Complete a guild challenge or contribute points', icon_name: 'Users', path: 'Guilds', points: 15 },
      ]);
    }
    setLoadingAi(false);
  };

  const toggleTask = (taskId) => {
    if (!user) return;
    const key = `todo_completed_${user.id}_${new Date().toDateString()}`;
    let updated;
    if (completedTasks.includes(taskId)) {
      updated = completedTasks.filter(t => t !== taskId);
    } else {
      updated = [...completedTasks, taskId];
      toast.success('Task completed! Points earned!');
    }
    setCompletedTasks(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const allMandatoryDone = MANDATORY_TASKS.every(t => completedTasks.includes(t.id));
  const totalTasks = MANDATORY_TASKS.length + aiTasks.length;
  const completedCount = completedTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const getIcon = (name) => {
    const icons = { Star, Trophy, Users, Zap, DollarSign, ShoppingCart, MessageSquare, Download };
    return icons[name] || Star;
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

          {/* Progress Bar */}
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{completedCount}/{totalTasks} tasks completed</p>
                <p className="text-sm font-bold">{totalPoints} pts earned</p>
              </div>
              <div className="w-full bg-white/30 rounded-full h-3">
                <motion.div
                  className="bg-white rounded-full h-3"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              {allMandatoryDone && (
                <p className="text-xs mt-2 text-yellow-200">🎉 All mandatory tasks done! Great work today!</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* MANDATORY TASKS */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-gray-900">Mandatory Tasks</h2>
            <Badge className="bg-red-500 text-white text-xs">Required Daily</Badge>
          </div>
          <div className="space-y-3">
            {MANDATORY_TASKS.map((task, i) => {
              const done = completedTasks.includes(task.id);
              const Icon = task.icon;
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className={`border-2 transition-all ${done ? 'border-green-400 bg-green-50' : task.bg}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="flex-shrink-0"
                      >
                        {done
                          ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                          : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />
                        }
                      </button>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-200' : 'bg-white shadow'}`}>
                        <Icon className={`w-5 h-5 ${done ? 'text-green-600' : task.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                        <p className="text-xs text-gray-500">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`${task.badgeBg} text-white text-xs`}>+{task.points}pts</Badge>
                        {!done && (
                          <Link to={createPageUrl(task.action.path)}>
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                              {task.action.label}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* AI-GENERATED TASKS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <h2 className="font-bold text-gray-900">AI-Generated Tasks</h2>
              <Badge className="bg-purple-500 text-white text-xs">Personalized</Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => user && loadAITasks(user)}
              disabled={loadingAi}
              className="text-xs"
            >
              {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>

          {loadingAi ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">AI is generating your personalized tasks…</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {aiTasks.map((task, i) => {
                  const done = completedTasks.includes(task.id);
                  const Icon = getIcon(task.icon_name);
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className={`border transition-all ${done ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
                            {done
                              ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                              : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />
                            }
                          </button>
                          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                            <p className="text-xs text-gray-500">{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className="bg-purple-100 text-purple-700 text-xs">+{task.points || 10}pts</Badge>
                            {!done && task.path && (
                              <Link to={createPageUrl(task.path)}>
                                <Button size="sm" variant="outline" className="text-xs h-7 px-2">Go</Button>
                              </Link>
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