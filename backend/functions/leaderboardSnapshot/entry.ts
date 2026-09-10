import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { rankRows, toSnapshotDoc, windowCutoff, type RankRow } from "../../sdk/leaderboard.ts";

// leaderboardSnapshot (INTERNAL/ADMIN, scheduled) — precomputes the GLOBAL friendly-competition rankings so the
// user-facing `leaderboard` function never scans DailyEarnings/User/Referral (tens of thousands of rows) on the
// hot path. For each metric it computes the full ranking with BOUNDED-MEMORY db.scan() (keyset pagination — the
// aggregation maps hold one small entry per user, never the raw rows), then upserts one LeaderboardSnapshot row
// per metric holding the top SNAPSHOT_TOP ranked entries. Cost stays O(active users) once per run, not per read.
//
// Compliance note: this stores only { user_id, rank, value }. The reader decides what to expose — financial
// metrics (earner/saver) are still returned RANK-ONLY there, so no dollar amount ever reaches a client.
//
// Metrics:
//   earner/surveys/streak  — last-7-day DailyEarnings (one scan feeds all three).
//   saver/level            — current User.points / User.level (one scan feeds both).
//   referrals              — count of active Referral per referrer (one scan).
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const computedAt = new Date().toISOString();
    const written: Record<string, number> = {};

    // Upsert one snapshot row per metric (found by { metric } — GIN-accelerated containment).
    const upsert = async (metric: string, ranked: ReturnType<typeof rankRows>) => {
      const doc = toSnapshotDoc(metric, ranked, computedAt);
      const existing = (await db.filter("LeaderboardSnapshot", { metric }, "-updated_date", 1).catch(() => []))[0] as
        | Record<string, unknown>
        | undefined;
      if (existing?.id) await db.update("LeaderboardSnapshot", existing.id as string, doc);
      else await db.create("LeaderboardSnapshot", doc);
      written[metric] = doc.total_ranked;
    };

    // --- earner / surveys / streak: last-7-day DailyEarnings, one bounded scan feeds all three ---
    {
      const cutoff = windowCutoff();
      const agg = new Map<string, { earned: number; surveys: number; days: Set<string> }>();
      for await (const batch of db.scan("DailyEarnings", { date: { $gte: cutoff } }, 2000)) {
        for (const r of batch) {
          const day = String(r.date || "");
          if (!day || day < cutoff) continue; // guard: $gte is lexicographic; keep the exact window
          const uid = String(r.user_id || "");
          if (!uid) continue;
          let a = agg.get(uid);
          if (!a) { a = { earned: 0, surveys: 0, days: new Set() }; agg.set(uid, a); }
          a.earned += Number(r.total_earned) || 0;
          a.surveys += Number(r.total_surveys_completed) || 0;
          if ((Number(r.total_earned) || 0) > 0 || (Number(r.survey_gross) || 0) > 0) a.days.add(day);
        }
      }
      const earnerRows: RankRow[] = [];
      const surveyRows: RankRow[] = [];
      const streakRows: RankRow[] = [];
      for (const [uid, a] of agg) {
        earnerRows.push({ user_id: uid, value: a.earned });
        surveyRows.push({ user_id: uid, value: a.surveys });
        streakRows.push({ user_id: uid, value: a.days.size });
      }
      await upsert("earner", rankRows(earnerRows));
      await upsert("surveys", rankRows(surveyRows));
      await upsert("streak", rankRows(streakRows));
    }

    // --- saver / level: current User fields, one bounded scan feeds both ---
    {
      const saverRows: RankRow[] = [];
      const levelRows: RankRow[] = [];
      for await (const batch of db.scan("User", {}, 2000)) {
        for (const u of batch) {
          const uid = String(u.id || "");
          if (!uid) continue;
          saverRows.push({ user_id: uid, value: Number(u.points) || 0 });
          levelRows.push({ user_id: uid, value: Number(u.level) || 1 });
        }
      }
      await upsert("saver", rankRows(saverRows));
      await upsert("level", rankRows(levelRows));
    }

    // --- referrals: count of active Referral per referrer, one bounded scan ---
    {
      const count = new Map<string, number>();
      for await (const batch of db.scan("Referral", { status: "active" }, 2000)) {
        for (const r of batch) {
          const uid = String(r.referrer_user_id || "");
          if (!uid) continue;
          count.set(uid, (count.get(uid) || 0) + 1);
        }
      }
      const rows: RankRow[] = [];
      for (const [uid, v] of count) rows.push({ user_id: uid, value: v });
      await upsert("referrals", rankRows(rows));
    }

    return Response.json({ success: true, computed_at: computedAt, ranked: written });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
