import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";

// platformInsights (ADMIN / brand-facing) — the compliant seed of the market-research supply business
// (flywheel #1). Returns AGGREGATE-only, consent-gated audience/survey insights that brands and researchers
// pay for. HARD privacy guarantees, by construction:
//   • Never returns individual records or PII — only counts/percentages over cohorts.
//   • k-anonymity: any cohort smaller than INSIGHTS_MIN_COHORT is suppressed (shown as null), so no person
//     can be re-identified.
//   • Only counts users who CONSENTED to research use (ConsentLedger), never the rest.
// This is what lets the biggest-TAM flywheel scale LEGALLY. See SCALE-TO-AMAZON-STRATEGY.md.
//   Body: { dimension?: "country"|"tier"|"activity" }  → { dimension, cohorts:[{key,count|null,pct|null}], suppressed }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("INSIGHTS_ENABLED", true)) return Response.json({ error: "Insights product is off." }, { status: 403 });

    const minCohort = Math.max(5, snapNumber("INSIGHTS_MIN_COHORT", 50));
    const body = await req.json().catch(() => ({}));
    const dimension = ["country", "tier", "activity"].includes(String(body.dimension)) ? String(body.dimension) : "country";

    // Consent gate: only users who opted into research use are counted. Aggregate their bucket, nothing else.
    const consents = await db.filter("ConsentLedger", { purpose: "research", granted: true }, "-created_date", 200000).catch(() => []) as Record<string, unknown>[];
    const consentedIds = new Set((consents || []).map((c) => String(c.user_id)));

    const buckets: Record<string, number> = {};
    let total = 0;
    if (consentedIds.size > 0) {
      // Aggregate consented users only, by the requested dimension. Bounded scan.
      const users = await db.filter("User", {}, "-created_date", 200000).catch(() => []) as Record<string, unknown>[];
      for (const u of users || []) {
        if (!consentedIds.has(String(u.id))) continue;
        let key = "unknown";
        if (dimension === "country") key = String(u.country || "unknown");
        else if (dimension === "tier") key = u.is_premium ? "premium" : "standard";
        else if (dimension === "activity") key = (Number(u.total_earnings) || 0) > 0 ? "active" : "new";
        buckets[key] = (buckets[key] || 0) + 1;
        total++;
      }
    }

    // Apply k-anonymity: suppress any cohort below the minimum so no individual can be re-identified.
    let suppressed = 0;
    const cohorts = Object.entries(buckets).map(([key, count]) => {
      if (count < minCohort) { suppressed++; return { key, count: null, pct: null }; }
      return { key, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
    }).sort((a, b) => (b.count || 0) - (a.count || 0));

    return Response.json({
      dimension,
      consented_total: total >= minCohort ? total : null,   // suppress the grand total too if tiny
      min_cohort: minCohort,
      cohorts,
      suppressed,
      note: "Aggregate-only, consent-gated, k-anonymity-protected. No individual data is ever returned. This is the compliant market-research supply product (flywheel #1).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
