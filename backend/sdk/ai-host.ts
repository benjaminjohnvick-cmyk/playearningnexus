// ai-host.ts — pure logic for the "AI-hosted fallback live session." When an advertiser's product isn't
// converting on social (weak CTR / few conversions despite enough impressions), the platform can spin up a live
// shopping session hosted by an AI PRESENTER the advertiser configured to match their target demographic, using
// the Abacus.AI video engine wired earlier this session. This module decides WHEN to trigger the fallback and
// builds the render brief — with the advertising-compliance lines baked in.
//
// COMPLIANCE (encoded in the brief): the AI host is disclosed as AI-generated and as an ad (#ad); it never
// impersonates a real person; it presents product VALUE and never promises guaranteed income/results; and
// demographic matching is for creative fit, not targeting protected categories. Pure + unit-testable.

const round4 = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface FallbackThresholds {
  minImpressions: number;   // need enough data before judging (default 500)
  minCtrPct: number;        // click-through % below this = underperforming (default 0.5%)
  minConversions: number;   // conversions at/below this (with enough impressions) = underperforming (default 1)
}

export interface FallbackDecision {
  trigger: boolean;
  ctr_pct: number;
  reason: string;
}

/** Decide whether to launch an AI-hosted fallback session for a campaign. Only triggers once there's enough data
 *  (impressions >= minImpressions) AND performance is weak (low CTR or too few conversions). Pure. */
export function decideAiHostFallback(m: CampaignMetrics, t: FallbackThresholds): FallbackDecision {
  const impressions = Math.max(0, Number(m?.impressions) || 0);
  const clicks = Math.max(0, Number(m?.clicks) || 0);
  const conversions = Math.max(0, Number(m?.conversions) || 0);
  const ctr = impressions > 0 ? round4((clicks / impressions) * 100) : 0;

  if (impressions < Math.max(1, t.minImpressions)) {
    return { trigger: false, ctr_pct: ctr, reason: `Not enough data yet (${impressions} < ${t.minImpressions} impressions).` };
  }
  const weakCtr = ctr < t.minCtrPct;
  const weakConv = conversions <= t.minConversions;
  if (weakCtr || weakConv) {
    const why = [weakCtr ? `CTR ${ctr}% < ${t.minCtrPct}%` : null, weakConv ? `conversions ${conversions} ≤ ${t.minConversions}` : null].filter(Boolean).join(" and ");
    return { trigger: true, ctr_pct: ctr, reason: `Underperforming (${why}) — launch AI-hosted fallback session.` };
  }
  return { trigger: false, ctr_pct: ctr, reason: `Performing OK (CTR ${ctr}%, ${conversions} conversions) — no fallback needed.` };
}

export interface AiHostBriefInput {
  productName: string;
  valueProps?: string[];
  targetDemographic?: string;   // creative fit only (e.g. "budget-conscious parents") — NOT protected-category targeting
  disclosureTag?: string;       // e.g. "#ad"
}

/** Build the render prompt for the AI host video, with the compliance constraints inline so the generated host
 *  is disclosed, non-impersonating, and doesn't promise results. Pure. */
export function buildAiHostBrief(i: AiHostBriefInput): { prompt: string; disclosure: Record<string, unknown> } {
  const tag = i.disclosureTag || "#ad";
  const props = (i.valueProps || []).filter(Boolean).slice(0, 6);
  const demo = (i.targetDemographic || "").trim();
  const prompt =
    `Create a short, upbeat live-shopping style presenter segment for the product "${i.productName}".` +
    (props.length ? ` Highlight these genuine features/benefits: ${props.join("; ")}.` : "") +
    (demo ? ` Style/tone should resonate with: ${demo} (creative tone only).` : "") +
    ` HARD REQUIREMENTS: the presenter is an AI-generated spokesperson (state or clearly imply it is not a real ` +
    `person and does not depict a real individual); include the ad disclosure "${tag}"; describe product VALUE ` +
    `only — do NOT promise earnings, savings guarantees, medical/financial outcomes, or any guaranteed result; ` +
    `no fabricated testimonials or fake reviews; keep claims to what the advertiser actually provided.`;
  return {
    prompt,
    disclosure: { ai_generated: true, not_a_real_person: true, ad_disclosure: tag, no_guaranteed_results: true, demographic_is_creative_only: true },
  };
}
