import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { tier1SelfPacedConfig, activeSelfPacedPlan, selfPacedStatus, selfPacedDisclosures } from "../../sdk/tier1-selfpaced.ts";

// tier1SelfPacedStatus (read) — the Tier 1 Self-Paced (no-debt) subscription status for the caller.
// Returns the config, the caller's plan status (paid-to-date, delivered impressions, progress toward the
// optional annual package), and disclosures. amount_owed is always 0 — this is not credit.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await tier1SelfPacedConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const plan = await activeSelfPacedPlan(String(user.id));
    return Response.json({
      enabled: true,
      config: {
        monthly_base_usd: cfg.monthlyBaseUsd,
        annual_target_usd: cfg.annualTargetUsd,
        term_months: cfg.termMonths,
        min_payment_usd: cfg.minPaymentUsd,
        max_payment_usd: cfg.maxPaymentUsd,
        allow_pause: cfg.allowPause,
      },
      status: selfPacedStatus(plan, cfg),
      disclosures: selfPacedDisclosures(cfg),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
