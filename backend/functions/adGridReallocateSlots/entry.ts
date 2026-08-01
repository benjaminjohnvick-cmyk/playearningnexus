import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import {
  engagementScore, reallocEligible, rankCandidates,
  reallocLookbackDays, reallocMinDailyTakeUsd, reallocMaxGrantsPerDay,
} from "../../sdk/reallocation.ts";

// adGridReallocateSlots (INTERNAL/ADMIN, scheduled) — reallocate unused premium AdGrid slots to the best
// non-premium earners for the day. Premium members with no earning activity today are treated as no-shows;
// their slots are granted to consistent, engaged non-premium users (a one-day AdGrid pass). Moves inventory,
// not cash.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - (reallocLookbackDays() - 1) * 86400000).toISOString().slice(0, 10);
    const minTake = reallocMinDailyTakeUsd();

    // 1) Premium members and who's active today.
    const premiumRows = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const premiumIds = new Set((premiumRows || []).filter((m) => m.status !== "ended").map((m) => String(m.user_id)));

    const todayEarn = await db.filter("DailyEarnings", { date: today }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const activeTodayIds = new Set((todayEarn || []).filter((d) => (Number(d.total_earned) || 0) > 0).map((d) => String(d.user_id)));

    // No-shows = premium members with no earning activity today → their slots are releasable.
    let releasable = 0;
    for (const pid of premiumIds) if (!activeTodayIds.has(pid)) releasable++;
    releasable = Math.min(releasable, reallocMaxGrantsPerDay());
    if (releasable <= 0) return Response.json({ success: true, granted: 0, reason: "no_unused_premium_slots" });

    // 2) Non-premium candidates: aggregate their take over the lookback window.
    const recent = await db.filter("DailyEarnings", {}, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const byUser = new Map<string, { day: string; take_usd: number }[]>();
    for (const row of (recent || [])) {
      const d = String(row.date || "");
      if (!d || d < cutoff) continue;
      const uid = String(row.user_id || "");
      if (!uid || premiumIds.has(uid)) continue;             // non-premium only
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push({ day: d, take_usd: Number(row.total_earned) || 0 });
    }

    const candidates: { user_id: string; engagement: number; consistent_days: number }[] = [];
    for (const [uid, history] of byUser) {
      const engagement = engagementScore({ history, earnedToday: activeTodayIds.has(uid), minTakeUsd: minTake });
      const elig = reallocEligible({ history, engagement });
      if (elig.eligible) candidates.push({ user_id: uid, engagement, consistent_days: elig.consistent_days });
    }

    // Skip users already granted today.
    const grantedToday = await db.filter("AdGridSlotGrant", { granted_date: today }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const already = new Set((grantedToday || []).map((g) => String(g.user_id)));
    const fresh = candidates.filter((c) => !already.has(c.user_id));

    const winners = rankCandidates(fresh, releasable);

    // 3) Grant + notify.
    let granted = 0;
    const expires = `${today}T23:59:59.999Z`;
    for (const w of winners) {
      await base44.asServiceRole.entities.AdGridSlotGrant.create({
        user_id: w.user_id, granted_date: today, source: "reallocation",
        engagement: w.engagement, consistent_days: w.consistent_days, expires_at: expires, used: false,
      }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: w.user_id, type: "reward",
        title: "⚡ Premium-speed surveys unlocked today",
        message: "You've earned a one-day pass to our highest-paying surveys — jump in before the day ends.",
      }).catch(() => null);
      granted++;
    }

    return Response.json({ success: true, granted, releasable, candidates: candidates.length, date: today });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
