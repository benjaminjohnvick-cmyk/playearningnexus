import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier2Status } from "../../sdk/tier2-scaling.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";

// tier2ScalingStatus (read-only) — the caller's Tier 2 "Scale" progression: the 30-day part ladder, which
// part is next, whether the 30-day + results gates are met, and the discount that applies right now (6% in
// the first year for anyone; perpetual for founding members). Never charges.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const todayISO = new Date().toISOString();

    // Founding member = holds a founding Tier 1 seat (not refunded/cancelled).
    const faRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const fa = faRows && faRows[0] ? faRows[0] : null;
    const isFounding = !!fa && !["refunded", "cancelled"].includes(String(fa.status ?? "").toLowerCase());

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows && rows[0] ? rows[0] : null;

    // Real attributed results accrued on the CURRENT part (for the results gate).
    let lastPartResultsUsd = 0;
    if (rec && rec.current_part_started_at) {
      lastPartResultsUsd = await attributedSalesUsd(db, uid, String(rec.current_part_started_at)).catch(() => 0);
    }

    const status = tier2Status(rec, isFounding, todayISO, lastPartResultsUsd);
    return Response.json({ status, has_plan: !!rec });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
