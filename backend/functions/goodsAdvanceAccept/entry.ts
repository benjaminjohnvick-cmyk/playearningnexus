import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { advanceConfig, assessEligibility, disclosureLines } from "../../sdk/goods-advance.ts";

// goodsAdvanceAccept — opt-in origination. HARD-GATED: refuses unless the program is live
// (flag ON + a licensed provider configured + counsel sign-off). Records disclosure consent and an
// approved advance; actual disbursement is performed by the configured licensed provider integration.
// This scaffold NEVER moves money by itself and has NO lockout, backup-card charge, or collections.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await advanceConfig(jurisdiction);

    // Origination is impossible until the program is fully configured and signed off.
    if (!cfg.live) {
      return Response.json({ error: "Goods Advance is not available yet.", code: "program_not_live" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requested = Number((body as Record<string, unknown>).amount_usd ?? 0);
    const consent = (body as Record<string, unknown>).disclosures_acknowledged === true;
    if (!consent) {
      return Response.json({ error: "You must review and accept the disclosures.", disclosures: disclosureLines(cfg) }, { status: 400 });
    }
    const eligibility = await assessEligibility(user as Record<string, unknown>, jurisdiction);
    if (!eligibility.available || requested <= 0 || requested > eligibility.maxOfferUsd) {
      return Response.json({ error: "Requested amount exceeds your available offer.", maxOfferUsd: eligibility.maxOfferUsd }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const row = await db.create("GoodsAdvance", {
      user_id: user.id,
      principal_usd: requested,
      repaid_usd: 0,
      apr_pct: cfg.aprPct,
      term_months: cfg.termMonths,
      non_recourse: cfg.nonRecourse,
      status: "approved_pending_disbursement",
      provider: cfg.provider,
      disclosures: disclosureLines(cfg),
      disclosures_accepted: true,
      disclosures_accepted_at: new Date().toISOString(),
      consent_ip: ip,
    }, user.id);
    return Response.json({ success: true, advance: row, note: "Approved. Disbursement is handled by the configured lending provider (ADVANCE_PROVIDER)." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
