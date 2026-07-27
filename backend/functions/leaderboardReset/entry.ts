import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber } from "../../sdk/settings.ts";

// leaderboardReset (INTERNAL/ADMIN, scheduled daily; self-gates on cadence) — the periodic WEEKLY
// leaderboard reset. Per the product decision: all-time `score` is kept untouched; a SEPARATE weekly
// board is derived as `score - period_baseline`, and each period's winners are ARCHIVED before the
// board resets.
//
// How it works without touching any score writer: the weekly rank is the growth in all-time score
// during the period (`score - period_baseline`). On reset we archive the period's top finishers, then
// re-baseline every entry (`period_baseline = current score`) so the next period measures fresh growth.
//
// Cadence: LEADERBOARD_RESET_DAYS (0 = disabled). Runs daily but only resets once the interval since
// the last archive has elapsed. Body { force: true } forces a reset now (admin/manual).
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const resetDays = await getNumber("LEADERBOARD_RESET_DAYS", 7);
    if (resetDays <= 0) return Response.json({ skipped: true, reason: "weekly reset disabled (0 days)" });

    const body = await req.clone().json().catch(() => ({}));
    const force = body?.force === true;

    // Last reset = most recent archive's period_end.
    const lastArchive = (await base44.asServiceRole.entities.LeaderboardArchive.filter({}, "-period_end", 1).catch(() => []))[0] ?? null;
    const now = Date.now();
    const dueMs = resetDays * 86400000;
    const lastResetMs = lastArchive?.period_end ? new Date(lastArchive.period_end).getTime() : 0;
    if (lastResetMs && (now - lastResetMs) < dueMs && !force) {
      return Response.json({ skipped: true, next_reset_in_days: Math.ceil((dueMs - (now - lastResetMs)) / 86400000) });
    }

    const nowIso = new Date(now).toISOString();
    const periodStartIso = lastArchive?.period_end ?? new Date(now - dueMs).toISOString();

    const entries = await base44.asServiceRole.entities.LeaderboardEntry.list("-total_earnings", 5000).catch(() => []);

    // Rank metric = the app's cumulative leaderboard field (total_earnings, falling back to score).
    const rankMetric = (e: Record<string, unknown>) => Number(e.total_earnings) || Number(e.score) || 0;

    // Weekly ranking = growth in that cumulative metric during the period.
    const ranked = entries
      .map((e: Record<string, unknown>) => ({
        id: e.id as string,
        user_id: e.user_id ?? null,
        user_name: e.user_name ?? e.name ?? null,
        weekly: Math.round((rankMetric(e) - (Number(e.period_baseline) || 0)) * 100) / 100,
        all_time: rankMetric(e),
      }))
      .filter((r) => r.weekly > 0)
      .sort((a, b) => b.weekly - a.weekly);

    const winners = ranked.slice(0, 25).map((r, i) => ({
      rank: i + 1, user_id: r.user_id, user_name: r.user_name, period_score: r.weekly, all_time_score: r.all_time,
    }));

    // 1. Archive the period's winners BEFORE resetting.
    const archive = await base44.asServiceRole.entities.LeaderboardArchive.create({
      period_start: periodStartIso, period_end: nowIso, reset_days: resetDays,
      participants: ranked.length, winners, archived_at: nowIso,
    });

    // 2. Re-baseline the weekly board (keep all-time score; reset the separate weekly delta).
    let rebased = 0;
    for (const e of entries as Record<string, unknown>[]) {
      await base44.asServiceRole.entities.LeaderboardEntry
        .update(e.id as string, { period_baseline: rankMetric(e), period_start: nowIso })
        .catch(() => null);
      rebased++;
    }

    return Response.json({
      success: true, archive_id: (archive as Record<string, unknown>).id,
      period_start: periodStartIso, period_end: nowIso,
      archived_winners: winners.length, participants: ranked.length, rebased,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
