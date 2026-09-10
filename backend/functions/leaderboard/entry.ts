import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  isMetric, metricDef, rankRows, windowCutoff,
  type RankRow, type RankedEntry, type SnapshotEntry,
} from "../../sdk/leaderboard.ts";

// leaderboard (authenticated) — friendly-competition rankings. scope "friends" ranks you against your
// buddies + group; "global" ranks everyone. Financial metrics (earner, saver) are returned RANK-ONLY — no
// dollar amounts ever leave this function. Read-only.
//   Body: { metric, scope: "friends"|"global", limit? }  → { metric, scope, financial, entries[], my_rank }
//
// SCALE: "global" is served from a PRECOMPUTED snapshot (LeaderboardSnapshot, refreshed every ~15 min by the
// leaderboardSnapshot job) — one indexed row read instead of scanning up to 50k DailyEarnings / 5k Users / 50k
// Referrals on every request. "friends" is computed on the fly but the queries are tightly scoped to the small
// friend set ($in) + the 7-day window, so they stay cheap. If the snapshot hasn't been produced yet (fresh
// deploy, before the first run), global falls back to the bounded on-the-fly path so the endpoint still works.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const metric = isMetric(String(body.metric)) ? String(body.metric) : "earner";
    const scope = body.scope === "global" ? "global" : "friends";
    const limit = Math.max(3, Math.min(50, Number(body.limit) || 10));
    const def = metricDef(metric);

    // Shared tail: given the fully-ranked list, render the top slice (+ my rank), resolving first-names only.
    const render = async (ranked: Array<RankedEntry | SnapshotEntry>, totalRanked: number, computedAt?: string) => {
      const mine = ranked.find((e) => e.user_id === user.id) || null;
      const top = ranked.slice(0, limit);

      const needIds = new Set<string>(top.map((e) => e.user_id));
      needIds.add(user.id);
      const nameById = new Map<string, string>();
      for (const id of needIds) {
        const u = await base44.asServiceRole.entities.User.filter({ id }).then((r: any) => r[0]).catch(() => null);
        nameById.set(id, id === user.id ? "You" : (u?.full_name ? String(u.full_name).split(" ")[0] : "Player"));
      }

      const entries = top.map((e) => ({
        rank: e.rank,
        display_name: nameById.get(e.user_id) || "Player",
        is_me: e.user_id === user.id,
        // RANK-ONLY for financial metrics — never expose the dollar value.
        value: def.financial ? null : e.value,
        unit: def.financial ? "" : def.unit,
      }));

      return Response.json({
        metric, scope, label: def.label, financial: def.financial,
        entries,
        total_ranked: totalRanked,
        my_rank: mine?.rank || null,
        my_value: (mine && !def.financial) ? mine.value : null,
        ...(computedAt ? { computed_at: computedAt, source: "snapshot" } : {}),
      });
    };

    // ---- GLOBAL: serve the precomputed snapshot (one indexed row). Fall back if it isn't there yet. ----
    if (scope === "global") {
      const snap = (await db.filter("LeaderboardSnapshot", { metric }, "-updated_date", 1).catch(() => []))[0] as
        | Record<string, unknown>
        | undefined;
      const snapEntries = Array.isArray(snap?.entries) ? (snap!.entries as SnapshotEntry[]) : null;
      if (snapEntries) {
        return await render(snapEntries, Number(snap!.total_ranked) || snapEntries.length, String(snap!.computed_at || ""));
      }
      // Fallback (pre-first-snapshot only): bounded on-the-fly compute over the whole set.
      const rows = await globalRowsOnTheFly(base44, metric);
      return await render(rankRows(rows), rows.length);
    }

    // ---- FRIENDS: on the fly, but tightly scoped to the small friend set. ----
    const friendIds = new Set<string>([user.id]);
    {
      const ba = await db.filter("BuddyPair", { user_a: user.id, status: "active" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      const bb = await db.filter("BuddyPair", { user_b: user.id, status: "active" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      for (const p of ba) if (p.user_b) friendIds.add(String(p.user_b));
      for (const p of bb) if (p.user_a) friendIds.add(String(p.user_a));
      const groups = await db.filter("GroupSession", {}, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
      for (const g of groups) {
        const members = Array.isArray(g.members) ? (g.members as string[]).map(String) : [];
        if (members.includes(user.id)) members.forEach((m) => friendIds.add(m));
      }
    }
    const ids = [...friendIds];

    const rows: RankRow[] = [];
    if (metric === "earner" || metric === "surveys" || metric === "streak") {
      const cutoff = windowCutoff();
      // Scoped to the friend set + the 7-day window: a small, indexed read (not the 50k-row scan).
      const de = await db.filter("DailyEarnings", { user_id: { $in: ids }, date: { $gte: cutoff } }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
      const agg = new Map<string, { earned: number; surveys: number; days: Set<string> }>();
      for (const r of de) {
        const day = String(r.date || "");
        if (!day || day < cutoff) continue;
        const uid = String(r.user_id || "");
        if (!uid || !friendIds.has(uid)) continue;
        let a = agg.get(uid);
        if (!a) { a = { earned: 0, surveys: 0, days: new Set() }; agg.set(uid, a); }
        a.earned += Number(r.total_earned) || 0;
        a.surveys += Number(r.total_surveys_completed) || 0;
        if ((Number(r.total_earned) || 0) > 0 || (Number(r.survey_gross) || 0) > 0) a.days.add(day);
      }
      for (const [uid, a] of agg) rows.push({ user_id: uid, value: metric === "earner" ? a.earned : metric === "surveys" ? a.surveys : a.days.size });
    } else if (metric === "saver" || metric === "level") {
      const users = (await Promise.all(ids.map((id) => base44.asServiceRole.entities.User.filter({ id }).then((r: any) => r[0]).catch(() => null)))).filter(Boolean);
      for (const u of (users as Record<string, unknown>[])) {
        const uid = String(u.id);
        rows.push({ user_id: uid, value: metric === "saver" ? (Number(u.points) || 0) : (Number(u.level) || 1) });
      }
    } else if (metric === "referrals") {
      const refs = await db.filter("Referral", { status: "active", referrer_user_id: { $in: ids } }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
      const count = new Map<string, number>();
      for (const r of refs) {
        const uid = String(r.referrer_user_id || "");
        if (!uid || !friendIds.has(uid)) continue;
        count.set(uid, (count.get(uid) || 0) + 1);
      }
      for (const [uid, v] of count) rows.push({ user_id: uid, value: v });
    }

    return await render(rankRows(rows), rows.length);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

// Bounded on-the-fly GLOBAL compute — ONLY the pre-first-snapshot fallback. Uses the 7-day window to keep the
// activity read from being unbounded; still heavier than the snapshot, but transient.
async function globalRowsOnTheFly(base44: any, metric: string): Promise<RankRow[]> {
  const rows: RankRow[] = [];
  if (metric === "earner" || metric === "surveys" || metric === "streak") {
    const cutoff = windowCutoff();
    const de = await db.filter("DailyEarnings", { date: { $gte: cutoff } }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const agg = new Map<string, { earned: number; surveys: number; days: Set<string> }>();
    for (const r of de) {
      const day = String(r.date || "");
      if (!day || day < cutoff) continue;
      const uid = String(r.user_id || "");
      if (!uid) continue;
      let a = agg.get(uid);
      if (!a) { a = { earned: 0, surveys: 0, days: new Set() }; agg.set(uid, a); }
      a.earned += Number(r.total_earned) || 0;
      a.surveys += Number(r.total_surveys_completed) || 0;
      if ((Number(r.total_earned) || 0) > 0 || (Number(r.survey_gross) || 0) > 0) a.days.add(day);
    }
    for (const [uid, a] of agg) rows.push({ user_id: uid, value: metric === "earner" ? a.earned : metric === "surveys" ? a.surveys : a.days.size });
  } else if (metric === "saver" || metric === "level") {
    const users = await db.filter("User", {}, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
    for (const u of users) rows.push({ user_id: String(u.id), value: metric === "saver" ? (Number(u.points) || 0) : (Number(u.level) || 1) });
  } else if (metric === "referrals") {
    const refs = await db.filter("Referral", { status: "active" }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const count = new Map<string, number>();
    for (const r of refs) {
      const uid = String(r.referrer_user_id || "");
      if (!uid) continue;
      count.set(uid, (count.get(uid) || 0) + 1);
    }
    for (const [uid, v] of count) rows.push({ user_id: uid, value: v });
  }
  return rows;
}
