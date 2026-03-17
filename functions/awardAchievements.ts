import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Automation: runs on DailyEarnings create/update to check for achievements
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.user_id) {
      return Response.json({ error: 'Missing user data' }, { status: 400 });
    }

    const userId = data.user_id;
    const awarded = [];

    // Get all achievements
    const allAchievements = await base44.asServiceRole.entities.Achievement.list();

    // Get user's earned achievements
    const userAchievements = await base44.asServiceRole.entities.UserAchievement.filter({ user_id: userId });
    const earnedKeys = new Set(userAchievements.map(a => a.achievement_key));

    // Check each achievement
    for (const achievement of allAchievements) {
      if (earnedKeys.has(achievement.achievement_key)) continue;

      let shouldAward = false;

      // Surveys completed milestones
      if (achievement.achievement_key.startsWith('surveys_')) {
        const completedCount = await getCompletedSurveyCount(base44, userId);
        if (completedCount >= achievement.requirement_value) {
          shouldAward = true;
        }
      }

      // Referral achievements
      if (achievement.achievement_key.startsWith('referral_')) {
        const referralCount = await getReferralCount(base44, userId);
        if (referralCount >= achievement.requirement_value) {
          shouldAward = true;
        }
      }

      // 7-day streak
      if (achievement.achievement_key === 'streak_7') {
        const streak = await getConsecutiveDaysWithEarnings(base44, userId);
        if (streak >= 7) {
          shouldAward = true;
        }
      }

      // Total earnings milestone
      if (achievement.achievement_key.startsWith('earnings_')) {
        const totalEarnings = await getTotalEarnings(base44, userId);
        if (totalEarnings >= achievement.requirement_value) {
          shouldAward = true;
        }
      }

      if (shouldAward) {
        await base44.asServiceRole.entities.UserAchievement.create({
          user_id: userId,
          achievement_key: achievement.achievement_key,
          earned_at: new Date().toISOString()
        });
        awarded.push(achievement.achievement_key);
      }
    }

    return Response.json({
      user_id: userId,
      awarded,
      total_awarded: awarded.length
    });
  } catch (error) {
    console.error('Achievement award error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getCompletedSurveyCount(base44, userId) {
  const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
    user_id: userId,
    completed: true
  });
  return responses.length;
}

async function getReferralCount(base44, userId) {
  const referrals = await base44.asServiceRole.entities.Referral.filter({
    referrer_id: userId,
    is_active: true
  });
  return referrals.length;
}

async function getConsecutiveDaysWithEarnings(base44, userId) {
  const earnings = await base44.asServiceRole.entities.DailyEarnings.filter({
    user_id: userId,
    goal_met: true
  });

  if (earnings.length === 0) return 0;

  const sortedByDate = earnings.sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  let streak = 1;
  for (let i = 1; i < sortedByDate.length; i++) {
    const prevDate = new Date(sortedByDate[i - 1].date);
    const currDate = new Date(sortedByDate[i].date);
    const dayDiff = Math.floor((currDate - prevDate) / (1000 * 86400));
    
    if (dayDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function getTotalEarnings(base44, userId) {
  const earnings = await base44.asServiceRole.entities.DailyEarnings.filter({
    user_id: userId
  });
  return earnings.reduce((sum, e) => sum + (e.total_earned || 0), 0);
}