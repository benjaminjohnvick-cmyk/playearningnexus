import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export const usePushNotificationTriggers = (user) => {
  const [lastJackpot, setLastJackpot] = useState(0);
  const [lastDailyGoal, setLastDailyGoal] = useState(0);
  const notifiedRef = useRef({});

  useEffect(() => {
    if (!user?.id) return;

    const checkTriggers = async () => {
      try {
        // Check jackpot pool
        const transactions = await base44.entities.PPCTransaction.filter({}).catch(() => []);
        const currentJackpot = transactions.reduce((sum, t) => sum + (t.advertiser_fee || 0.1), 0) * 0.5;
        
        // Notify on new jackpot high
        if (currentJackpot > lastJackpot && currentJackpot - lastJackpot > 10) {
          const key = `jackpot_${Math.floor(currentJackpot / 100) * 100}`;
          if (!notifiedRef.current[key]) {
            notifyJackpotHigh(currentJackpot);
            notifiedRef.current[key] = true;
          }
          setLastJackpot(currentJackpot);
        }

        // Check daily goal progress
        const dailyGoals = await base44.entities.RedemptionRecord.filter({
          user_id: user.id,
          created_date: new Date().toISOString().split('T')[0]
        }).catch(() => []);
        const todayEarnings = dailyGoals.reduce((sum, g) => sum + (g.cost_balance || 0), 0);
        
        // Notify when nearing daily goal (assuming $50 daily goal)
        const dailyGoalTarget = 50;
        const percentComplete = (todayEarnings / dailyGoalTarget) * 100;
        if (percentComplete >= 80 && percentComplete < 100 && todayEarnings > lastDailyGoal) {
          const key = `daily_goal_80`;
          if (!notifiedRef.current[key]) {
            notifyDailyGoalNearing(todayEarnings, dailyGoalTarget);
            notifiedRef.current[key] = true;
          }
          setLastDailyGoal(todayEarnings);
        } else if (percentComplete >= 100 && todayEarnings > lastDailyGoal) {
          const key = `daily_goal_complete`;
          if (!notifiedRef.current[key]) {
            notifyDailyGoalComplete();
            notifiedRef.current[key] = true;
          }
          setLastDailyGoal(todayEarnings);
        }

        // Check for high-relevance ad matches from search history
        const recentSearches = await base44.entities.UserActivity.filter({
          user_id: user.id,
          activity_type: 'ppc_search'
        }).catch(() => []);

        if (recentSearches.length > 0) {
          const latestSearch = recentSearches[recentSearches.length - 1];
          const matches = await base44.functions.invoke('matchAdsToSearch', {
            searchQuery: latestSearch?.metadata?.search_query
          }).catch(() => ({ data: {} }));

          if (matches.data?.matches?.length > 0) {
            const topMatch = matches.data.matches[0];
            if (topMatch.relevance_score >= 90) {
              const key = `ad_match_${topMatch.ad_id}`;
              if (!notifiedRef.current[key]) {
                notifyHighRelevanceAdMatch(topMatch);
                notifiedRef.current[key] = true;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking push notification triggers:', error);
      }
    };

    // Check every 30 seconds
    checkTriggers();
    const interval = setInterval(checkTriggers, 30000);

    return () => clearInterval(interval);
  }, [user?.id, lastJackpot, lastDailyGoal]);
};

const notifyJackpotHigh = (amount) => {
  toast.success(`🎉 Jackpot Alert! Pool now at $${amount.toFixed(2)}!`, {
    description: 'Each search adds to the prize pool',
    duration: 5000
  });

  // Send web push if supported
  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('🎰 Jackpot Milestone!', {
        body: `The PPC pool just hit $${amount.toFixed(2)}! Keep searching to win big.`,
        icon: 'https://img.icons8.com/color/96/000000/treasure.png',
        badge: 'https://img.icons8.com/color/96/000000/cash.png',
        tag: 'jackpot-alert'
      });
    });
  }
};

const notifyDailyGoalNearing = (earned, target) => {
  const remaining = (target - earned).toFixed(2);
  toast.info(`📊 Almost there! $${remaining} away from your daily goal`, {
    description: 'Keep searching to reach your target',
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Daily Goal 80% Complete!', {
        body: `You've earned $${earned.toFixed(2)}. Just $${remaining} more to reach your goal!`,
        icon: 'https://img.icons8.com/color/96/000000/goal.png',
        tag: 'daily-goal'
      });
    });
  }
};

const notifyDailyGoalComplete = () => {
  toast.success(`🏆 Daily Goal Complete! Amazing work today!`, {
    description: 'Check back tomorrow for new goals',
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('🏆 Daily Goal Complete!', {
        body: 'You achieved your daily goal! Check back tomorrow for new challenges.',
        icon: 'https://img.icons8.com/color/96/000000/trophy.png',
        tag: 'goal-complete'
      });
    });
  }
};

const notifyHighRelevanceAdMatch = (ad) => {
  toast.info(`⚡ High-Match Ad Found: ${ad.actual_title}`, {
    description: `${ad.relevance_score}% match - $${ad.actual_reward.toFixed(2)} reward`,
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Perfect Match Found!', {
        body: `${ad.actual_title} (${ad.relevance_score}% match) - Earn $${ad.actual_reward.toFixed(2)}`,
        icon: 'https://img.icons8.com/color/96/000000/lightning-bolt.png',
        tag: 'ad-match'
      });
    });
  }
};