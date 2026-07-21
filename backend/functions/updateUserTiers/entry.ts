import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    let updated = 0;

    const TIER_THRESHOLDS = {
      bronze: { earnings: 0, streak: 0 },
      silver: { earnings: 100, streak: 7 },
      gold: { earnings: 500, streak: 30 },
      platinum: { earnings: 2000, streak: 100 },
    };

    const TIER_BENEFITS = {
      bronze: {
        withdrawal_speed_hours: 72,
        survey_multiplier: 1.0,
        exclusive_surveys: false,
        daily_limit: null,
      },
      silver: {
        withdrawal_speed_hours: 48,
        survey_multiplier: 1.1,
        exclusive_surveys: true,
        daily_limit: null,
      },
      gold: {
        withdrawal_speed_hours: 24,
        survey_multiplier: 1.25,
        exclusive_surveys: true,
        daily_limit: null,
      },
      platinum: {
        withdrawal_speed_hours: 4,
        survey_multiplier: 1.5,
        exclusive_surveys: true,
        daily_limit: null,
      },
    };

    for (const u of allUsers) {
      const earnings = u.total_earnings || 0;
      const streak = u.current_streak || 0;

      let newTier = 'bronze';
      if (earnings >= TIER_THRESHOLDS.platinum.earnings && streak >= TIER_THRESHOLDS.platinum.streak) {
        newTier = 'platinum';
      } else if (earnings >= TIER_THRESHOLDS.gold.earnings && streak >= TIER_THRESHOLDS.gold.streak) {
        newTier = 'gold';
      } else if (earnings >= TIER_THRESHOLDS.silver.earnings && streak >= TIER_THRESHOLDS.silver.streak) {
        newTier = 'silver';
      }

      const benefits = TIER_BENEFITS[newTier];

      try {
        await base44.asServiceRole.entities.TieredMembership.create({
          user_id: u.id,
          tier: newTier,
          total_earnings: earnings,
          current_streak: streak,
          exclusive_survey_access: newTier !== 'bronze',
          withdrawal_speed_hours: benefits.withdrawal_speed_hours,
          tier_benefits: benefits,
          last_updated: new Date().toISOString(),
        });
        updated++;
      } catch {
        // Try update if exists
        try {
          const existing = await base44.asServiceRole.entities.TieredMembership.filter({ user_id: u.id });
          if (existing.length > 0) {
            await base44.asServiceRole.entities.TieredMembership.update(existing[0].id, {
              tier: newTier,
              total_earnings: earnings,
              current_streak: streak,
              exclusive_survey_access: newTier !== 'bronze',
              withdrawal_speed_hours: benefits.withdrawal_speed_hours,
              tier_benefits: benefits,
              last_updated: new Date().toISOString(),
            });
            updated++;
          }
        } catch {}
      }
    }

    return Response.json({ success: true, updated, message: `Updated tier status for ${updated} users` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});