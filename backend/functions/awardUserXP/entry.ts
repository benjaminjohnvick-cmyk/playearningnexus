import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

const LEVEL_XP_CURVE = 100; // Each level requires 100 more XP than previous
const XP_PER_SURVEY = 10;
const XP_PER_STREAK_DAY = 5;

const TITLES_BY_LEVEL = {
  1: 'Newbie', 5: 'Surveyor', 10: 'Expert', 15: 'Master', 
  20: 'Legend', 25: 'Oracle', 30: 'Sage', 40: 'Mythic', 50: 'Ascended'
};

const PROFILE_FRAMES = {
  5: 'Silver Frame', 10: 'Gold Frame', 15: 'Platinum Frame',
  20: 'Diamond Frame', 30: 'Cosmic Frame', 50: 'Eternal Frame'
};

const EXCLUSIVE_CATEGORIES = {
  10: 'tech_surveys', 15: 'finance_surveys', 20: 'health_surveys',
  25: 'travel_surveys', 30: 'premium_surveys', 40: 'vip_surveys'
};

const BADGES = [
  { id: 'first_survey', name: 'First Step', icon: '🎬', requirement: 'surveys_completed', value: 1 },
  { id: 'survey_master', name: 'Survey Master', icon: '🏆', requirement: 'surveys_completed', value: 100 },
  { id: 'on_fire', name: 'On Fire', icon: '🔥', requirement: 'streak', value: 7 },
  { id: 'unstoppable', name: 'Unstoppable', icon: '⚡', requirement: 'streak', value: 30 },
  { id: 'level_5', name: 'Rising Star', icon: '⭐', requirement: 'level_reached', value: 5 },
  { id: 'level_10', name: 'Hall of Fame', icon: '🌟', requirement: 'level_reached', value: 10 },
  { id: 'xp_legend', name: 'XP Legend', icon: '👑', requirement: 'xp_threshold', value: 5000 }
];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { xp_amount, reason = 'survey_completion' } = await req.json();

    if (!xp_amount || xp_amount <= 0) {
      return Response.json({ error: 'Invalid XP amount' }, { status: 400 });
    }

    // Get or create user level record
    let userLevel = null;
    try {
      const existing = await base44.asServiceRole.entities.UserLevel.filter({ user_id: user.id });
      userLevel = existing[0];
    } catch (e) {
      userLevel = null;
    }

    if (!userLevel) {
      userLevel = await base44.asServiceRole.entities.UserLevel.create({
        user_id: user.id,
        total_xp: 0,
        current_level: 1,
        lifetime_surveys_completed: 0,
        current_title: 'Newbie'
      });
    }

    // Add XP
    let newTotalXp = userLevel.total_xp + xp_amount;
    let currentLevel = userLevel.current_level;
    let leveledUp = false;
    let newTitle = userLevel.current_title;
    let newFrame = userLevel.profile_frame;
    let unlockedCategories = userLevel.unlocked_survey_categories || [];

    // Check for level ups
    while (currentLevel < 50) {
      const xpRequired = LEVEL_XP_CURVE * currentLevel;
      if (newTotalXp >= xpRequired) {
        currentLevel++;
        leveledUp = true;

        // Update title if applicable
        if (TITLES_BY_LEVEL[currentLevel]) {
          newTitle = TITLES_BY_LEVEL[currentLevel];
        }

        // Unlock profile frame
        if (PROFILE_FRAMES[currentLevel]) {
          newFrame = PROFILE_FRAMES[currentLevel];
        }

        // Unlock exclusive survey categories
        if (EXCLUSIVE_CATEGORIES[currentLevel]) {
          unlockedCategories.push(EXCLUSIVE_CATEGORIES[currentLevel]);
        }
      } else {
        break;
      }
    }

    // Update user level
    await base44.asServiceRole.entities.UserLevel.update(userLevel.id, {
      total_xp: newTotalXp,
      current_level: currentLevel,
      current_title: newTitle,
      profile_frame: newFrame,
      unlocked_survey_categories: [...new Set(unlockedCategories)],
      last_activity: new Date().toISOString(),
      level_up_date: leveledUp ? new Date().toISOString() : userLevel.level_up_date
    });

    return Response.json({
      success: true,
      total_xp: newTotalXp,
      level: currentLevel,
      leveled_up: leveledUp,
      new_title: newTitle,
      new_frame: newFrame
    });

  } catch (error) {
    console.error('Error in awardUserXP:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});