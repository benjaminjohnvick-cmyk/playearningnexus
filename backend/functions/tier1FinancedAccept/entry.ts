import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier1FinancedConfig, assessTier1Eligibility, tier1DisclosureLines } from "../../sdk/tier1-financed.ts";

// tier1FinancedAccept — opt-in origination for the financed Tier 1 package. HARD-GATED: refuses unless the
// program is live (flag ON + licensed creditor configured + counsel sign-off). Records the advertiser's
// disclosure consent + earnings-sweep authorization and an approved plan. Because this is RECOURSE credit,
// the creditor of record (TIER1_FINANCED_PROVIDER) — not this app — services, bills, and collects the
// balance at term end under counsel-approved terms. This scaffold NEVER moves money, and wires NO lockout,
// NO backup-card charge, and NO collections logic.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await tier1FinancedConfig(jurisdiction);

    if (!cfg.live) {
      return Response.json({ error: "Tier 1 financing is not available yet.", code: "program_not_live" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const consent = (body as Record<string, unknown>).disclosures_acknowledged === true;
    const sweepAuthorized = (body as Record<string, unknown>).sweep_authorized === true;
    if (!consent || !sweepAuthorized) {
      return Response.json({
        error: "You must review and accept the disclosures AND authorize the earnings sweep.",
        disclosures: tier1DisclosureLines(cfg),
      }, { status: 400 });
    }
    const eligibility = await assessTier1Eligibility(user as Record<string, unknown>, jurisdiction);
    if (!eligibility.available) {
      return Response.json({ error: eligibility.reason || "Not eligible for Tier 1 financing." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const row = await db.create("Tier1FinancedPlan", {
      user_id: user.id,
      principal_usd: cfg.principalUsd,
      swept_usd: 0,
      remaining_usd: cfg.principalUsd,
      apr_pct: cfg.aprPct,
      term_months: cfg.termMonths,
      sweep_pct: cfg.sweepPct,
      recourse: cfg.recourse,               // true — a real balance is owed
      status: "active",
      provider: cfg.provider,               // creditor of record services/bills/collects
      disclosures: tier1DisclosureLines(cfg),
      disclosures_accepted: true,
      sweep_authorized: true,
      accepted_at: new Date().toISOString(),
      consent_ip: ip,
    }, user.id);
    return Response.json({
      success: true,
      plan: row,
      note: "Financed Tier 1 recorded. The configured creditor of record (TIER1_FINANCED_PROVIDER) originates, services, and settles the balance under its counsel-approved terms. This app applies the authorized earnings sweep only; it does not bill or collect.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
