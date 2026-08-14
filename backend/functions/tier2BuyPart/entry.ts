import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier2Status, tier2Ladder } from "../../sdk/tier2-scaling.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";

// tier2BuyPart — advance the Tier 2 scale-up by ONE 30-day part. Pay-as-you-go: each part is a separate
// upfront purchase (NOT credit). Buying the first part starts the plan; each later part requires ≥30 days on
// the current part AND (if configured) results. The actual charge for the part's net price runs through the
// normal purchase/checkout flow — this function records the progression and returns the amount due; it does
// NOT move money by itself.
//   Body: {}
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const nowISO = new Date().toISOString();

    const faRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const fa = faRows && faRows[0] ? faRows[0] : null;
    const isFounding = !!fa && !["refunded", "cancelled"].includes(String(fa.status ?? "").toLowerCase());

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    let rec = rows && rows[0] ? rows[0] as Record<string, unknown> : null;

    let lastPartResultsUsd = 0;
    if (rec && rec.current_part_started_at) {
      lastPartResultsUsd = await attributedSalesUsd(db, uid, String(rec.current_part_started_at)).catch(() => 0);
    }

    const status = tier2Status(rec, isFounding, nowISO, lastPartResultsUsd);
    if (status.complete) return Response.json({ error: "Tier 2 is already complete.", status }, { status: 400 });

    // First part is always allowed; later parts require the gates.
    const partsDone = rec ? (Number(rec.parts_completed) || 0) : 0;
    if (partsDone > 0 && !status.next_part_eligible) {
      return Response.json({ error: status.reason, status }, { status: 400 });
    }

    const ladder = tier2Ladder();
    const partIndex = partsDone;                 // 0-based index of the part being bought now
    const part = ladder[partIndex];
    const netDue = status.current_part_net_usd ?? part.base_amount_usd;
    const newPartsDone = partsDone + 1;
    const newPaid = Math.round(((Number(rec?.paid_usd) || 0) + netDue) * 100) / 100;
    const complete = newPartsDone >= ladder.length;

    const doc = {
      user_id: uid,
      started_at: rec?.started_at ?? nowISO,
      parts: ladder.length,
      parts_completed: newPartsDone,
      current_part_started_at: nowISO,
      is_founding: isFounding,
      paid_usd: newPaid,
      last_part_number: part.n,
      last_part_net_usd: netDue,
      last_discount_pct: status.discount_pct,
      status: complete ? "complete" : "active",
    };
    if (rec) rec = await db.update("Tier2ScalingPlan", String(rec.id), doc);
    else rec = await db.create("Tier2ScalingPlan", doc, uid);

    return Response.json({
      success: true,
      bought_part: part.n,
      amount_due_usd: netDue,                    // charge this via the normal checkout/processor
      discount_pct: status.discount_pct,
      parts_completed: newPartsDone,
      complete,
      plan: rec,
      note: "Part recorded. Charge the amount_due_usd through the normal checkout flow — this function does not move money. The next part unlocks after the 30-day window (and results, if gated).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
