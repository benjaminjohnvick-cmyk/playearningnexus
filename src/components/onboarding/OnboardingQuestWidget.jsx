import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ArrowRight, Star, Zap, Users, Tag, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const QUESTS = [
  {
    id: 'profile_tags',
    title: 'Set Your Interests',
    desc: 'Add at least 3 survey interest tags to your profile',
    icon: Tag,
    reward: 0.50,
    points: 50,
    check: (user, stats) => (user?.survey_interests?.length || 0) >= 3,
    cta: 'Go to Profile',
    ctaPath: 'UserProfile',
  },
  {
    id: 'join_group',
    title: 'Join a Group',
    desc: 'Join your first community group or guild',
    icon: Users,
    reward: 1.00,
    points: 100,
    check: (user, stats) => (stats?.groupsJoined || 0) >= 1,
    cta: 'Browse Groups',
    ctaPath: 'Guilds',
  },
  {
    id: 'first_survey',
    title: 'Complete Survey #1',
    desc: 'Finish your first survey to start earning',
    icon: ClipboardList,
    reward: 1.00,
    points: 100,
    check: (user, stats) => (stats?.surveysCompleted || 0) >= 1,
    cta: 'Find Surveys',
    ctaPath: 'Surveys',
  },
  {
    id: 'second_survey',
    title: 'Complete Survey #2',
    desc: 'Keep the momentum — finish a second survey',
    icon: ClipboardList,
    reward: 1.00,
    points: 100,
    check: (user, stats) => (stats?.surveysCompleted || 0) >= 2,
    cta: 'Find Surveys',
    ctaPath: 'Surveys',
  },
  {
    id: 'third_survey',
    title: 'Complete Survey #3',
    desc: 'Three surveys done — you\'re officially earning!',
    icon: Zap,
    reward: 1.50,
    points: 150,
    check: (user, stats) => (stats?.surveysCompleted || 0) >= 3,
    cta: 'Find Surveys',
    ctaPath: 'Surveys',
  },
];

const TOTAL_REWARD = QUESTS.reduce((s, q) => s + q.reward, 0); // $5.00

export default function OnboardingQuestWidget({ user }) {
  const [collapsed, setCollapsed] = useState(false);
  const [claimedIds, setClaimedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`onboarding_claimed_${user?.id}`) || '[]'); } catch { return []; }
  });
  const qc = useQueryClient();

  const { data: responses = [] } = useQuery({
    queryKey: ['onboarding_responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 10),
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  const { data: guilds = [] } = useQuery({
    queryKey: ['onboarding_guilds', user?.id],
    queryFn: () => base44.entities.Guild.filter({ member_ids: user.id }),
    enabled: !!user?.id,
  });

  const surveysCompleted = responses.length;
  const groupsJoined = guilds.length + (user?.user_group_id ? 1 : 0);
  const stats = { surveysCompleted, groupsJoined };

  const questStatuses = QUESTS.map(q => ({
    ...q,
    done: q.check(user, stats),
    claimed: claimedIds.includes(q.id),
  }));

  const completedCount = questStatuses.filter(q => q.done).length;
  const claimedCount = questStatuses.filter(q => q.claimed).length;
  const totalPct = (completedCount / QUESTS.length) * 100;
  const totalClaimed = questStatuses.filter(q => q.claimed).reduce((s, q) => s + q.reward, 0);

  // Hide widget if all quests claimed
  const allDone = claimedCount === QUESTS.length;

  // Also check membership age — only show for users < 14 days old
  const memberDays = user?.created_date
    ? Math.floor((Date.now() - new Date(user.created_date)) / 86400000)
    : 0;

  if (memberDays > 14 && allDone) return null;

  const handleClaim = async (quest) => {
    const newClaimed = [...claimedIds, quest.id];
    setClaimedIds(newClaimed);
    localStorage.setItem(`onboarding_claimed_${user.id}`, JSON.stringify(newClaimed));

    // Credit reward to balance
    await base44.functions.invoke('awardReward', { amount: quest.reward, reason: 'onboarding_quest', claim_key: `quest_${quest.id}` });
    toast.success(`+$${quest.reward.toFixed(2)} credited! Quest complete 🎉`, { description: quest.title });
    qc.invalidateQueries();
  };

  return (
    <Card className="border-2 border-violet-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Onboarding Quest</p>
              <p className="text-white/70 text-xs">Complete all 5 steps to earn ${TOTAL_REWARD.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-white/70">Claimed</p>
              <p className="font-black text-yellow-300">${totalClaimed.toFixed(2)}</p>
            </div>
            <button onClick={() => setCollapsed(!collapsed)} className="bg-white/10 hover:bg-white/20 p-1 rounded-lg ml-1">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>{completedCount}/{QUESTS.length} quests completed</span>
            <span>${TOTAL_REWARD.toFixed(2)} total prize</span>
          </div>
          <Progress value={totalPct} className="h-2 bg-white/20 [&>div]:bg-yellow-300" />
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <CardContent className="p-4 space-y-3">
              {questStatuses.map((quest, i) => {
                const Icon = quest.icon;
                const canClaim = quest.done && !quest.claimed;
                const isClaimed = quest.claimed;
                const isLocked = !quest.done && i > 0 && !questStatuses[i - 1]?.done;

                return (
                  <div key={quest.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      isClaimed ? 'bg-green-50 border-green-200' :
                      canClaim ? 'bg-violet-50 border-violet-300 shadow-sm' :
                      'bg-gray-50 border-gray-100'
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isClaimed ? 'bg-green-500' :
                      canClaim ? 'bg-violet-500' :
                      quest.done ? 'bg-blue-500' :
                      'bg-gray-200'
                    }`}>
                      {isClaimed
                        ? <CheckCircle2 className="w-4 h-4 text-white" />
                        : quest.done
                        ? <CheckCircle2 className="w-4 h-4 text-white" />
                        : <Icon className="w-4 h-4 text-white" />
                      }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isClaimed ? 'text-green-700 line-through opacity-70' : 'text-gray-800'}`}>
                          {quest.title}
                        </p>
                        <Badge className="text-xs bg-yellow-100 text-yellow-700 border-0">+${quest.reward.toFixed(2)}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{quest.desc}</p>
                    </div>

                    {/* Action */}
                    {isClaimed ? (
                      <span className="text-xs text-green-600 font-semibold flex-shrink-0">✓ Done</span>
                    ) : canClaim ? (
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs h-7 flex-shrink-0" onClick={() => handleClaim(quest)}>
                        Claim!
                      </Button>
                    ) : quest.done ? (
                      <Button size="sm" variant="outline" className="text-xs h-7 flex-shrink-0" onClick={() => handleClaim(quest)}>
                        Claim
                      </Button>
                    ) : (
                      <Link to={createPageUrl(quest.ctaPath)} className="flex-shrink-0">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                          {quest.cta} <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}

              {allDone && (
                <div className="text-center py-3 text-green-700 font-semibold text-sm">
                  🎉 All quests complete! You've earned ${TOTAL_REWARD.toFixed(2)}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}