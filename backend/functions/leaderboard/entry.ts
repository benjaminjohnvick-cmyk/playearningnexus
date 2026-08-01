import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMetric, metricDef, rankRows, type RankRow } from "../../sdk/leaderboard.ts";

// leaderboard (authenticated) — friendly-competition rankings. scope "friends" ranks you against your
// buddies + group; "global" ranks everyone. Financial metrics (earner, saver) are returned RANK-ONLY — no
// dollar amounts ever leave this function. Read-only.
//   Body: { metric, scope: "friends"|"global", limit? }  → { metric, scope, financial, entries[], my_rank }
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

    // Friend set (buddies + group members + self) for the "friends" scope.
    const friendIds = new Set<string>([user.id]);
    if (scope === "friends") {
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
    const inScope = (uid: string) => scope === "global" || friendIds.has(uid);

    // Build the value map for the requested metric.
    const rows: RankRow[] = [];
    if (metric === "earner" || metric === "surveys" || metric === "streak") {
      const cutoff = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);   // last 7 days incl today
      const de = await db.filter("DailyEarnings", {}, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
      const agg = new Map<string, { earned: number; surveys: number; days: Set<string> }>();
      for (const r of de) {
        const day = String(r.date || "");
        if (!day || day < cutoff) continue;
        const uid = String(r.user_id || "");
        if (!uid || !inScope(uid)) continue;
        if (!agg.has(uid)) agg.set(uid, { earned: 0, surveys: 0, days: new Set() });
        const a = agg.get(uid)!;
        a.earned += Number(r.total_earned) || 0;
        a.surveys += Number(r.total_surveys_completed) || 0;
        if ((Number(r.total_earned) || 0) > 0 || (Number(r.survey_gross) || 0) > 0) a.days.add(day);
      }
      for (const [uid, a] of agg) rows.push({ user_id: uid, value: metric === "earner" ? a.earned : metric === "surveys" ? a.surveys : a.days.size });
    } else if (metric === "saver" || metric === "level") {
      const users = scope === "friends"
        ? (await Promise.all([...friendIds].map((id) => base44.asServiceRole.entities.User.filter({ id }).then((r: any) => r[0]).catch(() => null)))).filter(Boolean)
        : await db.filter("User", {}, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
      for (const u of (users as Record<string, unknown>[])) {
        const uid = String((u as Record<string, unknown>).id);
        if (!inScope(uid)) continue;
        rows.push({ user_id: uid, value: metric === "saver" ? (Number(u.points) || 0) : (Number(u.level) || 1) });
      }
    } else if (metric === "referrals") {
      const refs = await db.filter("Referral", { status: "active" }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
      const count = new Map<string, number>();
      for (const r of refs) {
        const uid = String(r.referrer_user_id || "");
        if (!uid || !inScope(uid)) continue;
        count.set(uid, (count.get(uid) || 0) + 1);
      }
      for (const [uid, v] of count) rows.push({ user_id: uid, value: v });
    }

    const ranked = rankRows(rows);
    const mine = ranked.find((e) => e.user_id === user.id) || null;
    const top = ranked.slice(0, limit);

    // Names for the top entries (+ me), first-name only.
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
      total_ranked: ranked.length,
      my_rank: mine?.rank || null,
      my_value: (mine && !def.financial) ? mine.value : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
