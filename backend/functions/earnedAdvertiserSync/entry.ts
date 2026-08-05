import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  activityBreakdown, unlockLevelFor, unlockProgress, levelGrants, lastActiveISO,
  noupfrontParticipating, internalValueBreakdown, onboardingRequireInviteStep, EARN_MODE,
} from "../../sdk/earned-advertiser.ts";

// earnedAdvertiserSync (authenticated, self) — recompute the caller's activity and GRANT any newly-unlocked
// advertiser benefits. Idempotent. NEVER charges, NEVER reverses, NEVER creates a balance. Safe to call after
// a survey completion or on a schedule.
//   {} → { mode, progress, level, unlocked_now, participating? } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("EarnedAdvertiser", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec || rec.status === "stopped" || rec.status === "cancelled") {
      return Response.json({ error: "You're not enrolled in an earned/no-upfront tier." }, { status: 404 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const bd = await activityBreakdown(db, user.id, today);
    const progress = bd.score;
    const deRows = await db.filter("DailyEarnings", { user_id: user.id }, "-created_date", 4000).catch(() => []) as Record<string, unknown>[];
    const lastActive = lastActiveISO(deRows) || String(rec.last_active_at || today);

    const body = await req.json().catch(() => ({}));

    // Required onboarding invite step: the client calls with { invite_step_ack: true } once the user has been
    // shown/prompted the invite feature (whether or not they chose to send). Marks the step complete.
    const patch: Record<string, unknown> = {
      activity_progress: progress,
      last_active_at: lastActive,
      owed: 0, // reaffirm: always zero
    };
    if (body.invite_step_ack === true && rec.onboarding_invite_step === "pending") {
      patch.onboarding_invite_step = "done";
    }

    // INTERNAL-ONLY value realization toward the ~$8k LTV target ($5 per referral + survey spread). Stored on
    // the record for the OPERATOR's tracking; deliberately NOT returned in this user-facing response.
    const iv = await internalValueBreakdown(db, user.id);
    patch.internal_value_generated_usd = iv.generated_usd;
    patch.internal_value_remaining_usd = iv.remaining_usd;
    patch.internal_referral_value_usd = iv.referral_value_usd;
    patch.internal_survey_spread_usd = iv.survey_spread_usd;
    patch.internal_value_target_usd = iv.target_usd;

    let unlockedNow: Record<string, unknown> | null = null;
    let level = Number(rec.unlock_level) || 0;

    if (rec.mode === EARN_MODE.FREE) {
      const newLevel = unlockLevelFor(progress);
      if (newLevel > level) {
        level = newLevel;
        patch.unlock_level = newLevel;
        patch.perks_granted = levelGrants(newLevel);
        unlockedNow = levelGrants(newLevel);
        // Notify — framed as a reward for activity, never a payment.
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id, type: "advertiser_unlock",
          title: `🎉 You unlocked ${unlockedNow.name}!`,
          message: `A reward for staying active — more advertising benefits are now yours. Nothing owed, ever. Keep going to unlock more.`,
          is_read: false,
        }).catch(() => null);
      }
    }
    // no-upfront: level stays 4; we just refresh participation + progress for reporting/delivery gating.

    await db.update("EarnedAdvertiser", String(rec.id), patch).catch(() => null);

    const part = rec.mode === EARN_MODE.NOUPFRONT ? noupfrontParticipating({ ...rec, last_active_at: lastActive }, today) : null;

    return Response.json({
      ok: true,
      mode: rec.mode,
      metric: rec.metric,
      progress,
      level,
      next: unlockProgress(progress),
      unlocked_now: unlockedNow,
      participating: part ? part.participating : undefined,
      // Activity breakdown — referrals are the heaviest/fastest lever (optional, never required).
      breakdown: {
        surveys: bd.surveys, referrals: bd.referrals, active_days: bd.active_days,
        weights: bd.weights, daily_referral_goal: bd.daily_referral_goal,
        referrals_today: bd.referrals_today, hit_daily_goal: bd.hit_daily_goal,
      },
      // Required onboarding invite step (shown/prompted; sending optional; never a requirement to refer).
      onboarding: {
        require_invite_step: onboardingRequireInviteStep(),
        invite_step: patch.onboarding_invite_step ?? rec.onboarding_invite_step ?? "not_required",
        invite_step_pending: (patch.onboarding_invite_step ?? rec.onboarding_invite_step) === "pending",
      },
      // NOTE: internal $-value realization toward the $8k LTV is intentionally NOT included here — it's
      // operator-only and lives on the record / the admin ledger, never shown to the customer.
      owed: 0,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
