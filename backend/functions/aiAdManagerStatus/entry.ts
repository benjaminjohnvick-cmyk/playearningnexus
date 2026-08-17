import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { rateCard, deliveryPlan, aiAdManagerLive } from "../../sdk/ai-ad-manager.ts";
import { tier2TotalUsd, tier2Parts } from "../../sdk/tier2-scaling.ts";

// aiAdManagerStatus (auth) — the AI-managed Tier 2 delivery picture for the caller: the full A-D rate card
// (conventional list values vs the $200k bundle price + implied discount), and what the AI system has
// delivered so far given how many Tier 2 parts they've bought. Read-only; never charges.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows && rows[0] ? rows[0] : null;
    const partsCompleted = Math.max(0, Math.floor(Number(rec?.parts_completed) || 0));
    const parts = tier2Parts();

    const card = rateCard(tier2TotalUsd());
    return Response.json({
      ai_managed: await aiAdManagerLive(user.jurisdiction ?? user.state ?? null),
      has_plan: !!rec,
      parts_completed: partsCompleted,
      parts_total: parts,
      rate_card: card,
      delivered_so_far: deliveryPlan(partsCompleted, parts),
      note: "Every A-D line is delivered by the platform's AI system with no per-advertiser human staffing. " +
        "Research studies are fielded to REAL consented respondents; the campaign-manager line is an AI manager " +
        "(human escalation available), not a dedicated human. List values are conventional market rates; the " +
        "package bundles at the Tier 2 price.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
