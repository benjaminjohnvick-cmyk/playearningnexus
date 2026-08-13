// ai-funnel.ts — the AI concierge funnel engine. ONE recommender across the whole catalog with TWO gates:
//   • Gate 1 (fit): a recommendation from a short conversation BEFORE purchase — upsell / downsell / same.
//   • Gate 2 (results): a recommendation AFTER the commitment window, from the customer's REAL results.
//
// The money-affecting DECISION is DETERMINISTIC and explainable (rules + the customer's real numbers), not an
// opaque model choosing what to sell — an LLM may phrase the reply, but it never decides the offer. Every
// decision returns a `reason` and `disclosures` and is meant to be logged for the AI-oversight feed.
//
// HARD GUARDRAIL: a financial/credit product (financial:true) can NEVER be an UPSELL target unless the
// customer passes ability-to-repay AND the product is live. Downsell toward cheaper/free is always allowed.
import { snapNumber, snapString, snapBool } from "./settings.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface FunnelProduct {
  key: string; name: string; price_usd: number;
  up: string | null; down: string | null;
  window_days: number; metric: "attributed_sales" | "earnings" | "engagement"; financial: boolean;
}

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export function productGraph(): FunnelProduct[] {
  const raw = snapString("AI_FUNNEL_PRODUCT_GRAPH", "");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map((p) => ({
          key: String(p.key), name: String(p.name ?? p.key), price_usd: Math.max(0, Number(p.price_usd) || 0),
          up: p.up ? String(p.up) : null, down: p.down ? String(p.down) : null,
          window_days: Math.max(0, Number(p.window_days) || 0),
          metric: (["attributed_sales", "earnings", "engagement"].includes(p.metric) ? p.metric : "engagement"),
          financial: p.financial === true,
        })).filter((p) => p.key);
      }
    } catch { /* fall through */ }
  }
  return [];
}
export const strongResultMult = () => Math.max(0, snapNumber("AI_FUNNEL_STRONG_RESULT_MULT", 1.5));
export const weakResultMult = () => Math.max(0, snapNumber("AI_FUNNEL_WEAK_RESULT_MULT", 0.25));
export const maxUpsellAttempts = () => Math.max(0, snapNumber("AI_FUNNEL_MAX_UPSELL_ATTEMPTS", 2));
export const requireSuitabilityForFinancial = () => snapBool("AI_FUNNEL_REQUIRE_SUITABILITY_FOR_FINANCIAL", true);

// ── Illustrative example (pre-results). NOT a "typical return" — that would be a regulated earnings claim
// needing real substantiation, and a disclaimer does NOT cure an unsubstantiated claim. So before we have a
// customer's own data we show a clearly HYPOTHETICAL "how it works" illustration, or — only if the owner has
// attested to real evidence AND supplied a basis — a substantiated figure. We never fabricate a typical/average.
export const showIllustrativeExample = () => snapBool("AI_FUNNEL_SHOW_ILLUSTRATIVE_EXAMPLE", true);
export const exampleDisclaimer = () => snapString("AI_FUNNEL_EXAMPLE_DISCLAIMER",
  "Example only — hypothetical, to show how this works. It is NOT a prediction, a promise, or a typical result. Actual results vary widely and may be $0.") ||
  "Example only — hypothetical. Not a prediction or typical result; actual results vary and may be $0.";
export const benchmarksSubstantiated = () => snapBool("AI_FUNNEL_BENCHMARKS_SUBSTANTIATED", false);
export function substantiatedBenchmarks(): Record<string, { value: number; basis: string }> {
  const raw = snapString("AI_FUNNEL_SUBSTANTIATED_BENCHMARKS", "");
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, { value: number; basis: string }> = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = Number((v as Record<string, unknown>)?.value);
      const basis = String((v as Record<string, unknown>)?.basis ?? "");
      if (Number.isFinite(val) && basis.trim()) out[k] = { value: val, basis: basis.trim() };
    }
    return out;
  } catch { return {}; }
}

function niceRound(n: number): number {
  const x = Math.max(0, Number(n) || 0);
  if (x <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  return Math.round(x / mag) * mag;
}

export interface Illustration {
  kind: "hypothetical" | "substantiated";
  metric: string;
  example_usd: number | null;   // a round HYPOTHETICAL amount to show mechanics — not an expected value
  label: string;
  basis?: string | null;        // present only for substantiated
  disclaimer: string;
}

/** A pre-results illustration for a product. Substantiated (real evidence + basis, attested) if available;
 *  otherwise a clearly hypothetical "how it works" example. Never a fabricated "typical return." */
export function productIllustration(product: FunnelProduct | null): Illustration | null {
  if (!product) return null;
  if (benchmarksSubstantiated()) {
    const b = substantiatedBenchmarks()[product.key];
    if (b && b.basis && Number.isFinite(b.value)) {
      return { kind: "substantiated", metric: product.metric, example_usd: r2(b.value), basis: b.basis,
        label: "Based on real results", disclaimer: `Basis: ${b.basis}. Individual results still vary and are not guaranteed.` };
    }
  }
  if (!showIllustrativeExample()) return null;
  const ex = niceRound(product.price_usd * strongResultMult());
  return { kind: "hypothetical", metric: product.metric, example_usd: ex > 0 ? ex : null,
    label: "Illustrative example — hypothetical", disclaimer: exampleDisclaimer() };
}

export function findProduct(key: string | null | undefined): FunnelProduct | null {
  if (!key) return null;
  return productGraph().find((p) => p.key === key) ?? null;
}

// ── Signals from the Gate-1 conversation ────────────────────────────────────────────────────────────────
export interface FunnelSignals {
  goal?: "grow" | "try" | "save";
  capacity?: "high" | "medium" | "low";
  hesitation?: "price" | "trust" | "none";
  ability_to_repay?: boolean;   // must be TRUE for any financial-product upsell
}

/** Can we recommend this product as an UPSELL? Financial products require suitability + being live. */
export function suitabilityAllows(target: FunnelProduct, signals: FunnelSignals, isLive: (key: string) => boolean): { ok: boolean; reason: string } {
  if (!target.financial) return { ok: true, reason: "" };
  if (!requireSuitabilityForFinancial()) return { ok: true, reason: "" };
  if (!isLive(target.key)) return { ok: false, reason: `${target.name} is a credit product and is not currently available.` };
  if (signals.ability_to_repay !== true) return { ok: false, reason: `${target.name} is a credit product; it is only offered when ability-to-repay is confirmed. Not recommending it.` };
  return { ok: true, reason: "" };
}

export type Direction = "up" | "down" | "same" | "hold";

export interface Recommendation {
  gate: "fit" | "results";
  direction: Direction;
  current_key: string | null;
  recommend_key: string | null;
  recommend_name: string | null;
  recommend_price_usd: number | null;
  reason: string;
  blocked_reason?: string;      // set when an intended upsell was blocked by suitability
  disclosures: string[];
  illustration?: Illustration | null;  // pre-results "how it works" example (Gate 1); null when unavailable
}

function leanScore(s: FunnelSignals): number {
  let score = 0;
  score += s.goal === "grow" ? 2 : s.goal === "save" ? -2 : 0;
  score += s.capacity === "high" ? 2 : s.capacity === "low" ? -2 : 0;
  score += s.hesitation === "none" ? 1 : s.hesitation === "price" ? -2 : s.hesitation === "trust" ? -1 : 0;
  return score;
}

// ── Gate 1: recommend at purchase (fit) ─────────────────────────────────────────────────────────────────
export function recommendAtPurchase(signals: FunnelSignals, currentKey: string | null, isLive: (key: string) => boolean): Recommendation {
  const current = findProduct(currentKey) ?? productGraph()[0] ?? null;
  const base: Recommendation = {
    gate: "fit", direction: "same",
    current_key: current?.key ?? null,
    recommend_key: current?.key ?? null, recommend_name: current?.name ?? null, recommend_price_usd: current?.price_usd ?? null,
    reason: "", disclosures: funnelDisclosures(), illustration: productIllustration(current),
  };
  if (!current) return { ...base, reason: "No catalog configured." };

  const score = leanScore(signals);
  if (score >= 2 && current.up) {
    const target = findProduct(current.up);
    if (target) {
      const suit = suitabilityAllows(target, signals, isLive);
      if (suit.ok) {
        return { ...base, direction: "up", recommend_key: target.key, recommend_name: target.name, recommend_price_usd: target.price_usd,
          illustration: productIllustration(target),
          reason: `Your goal and capacity point to ${target.name} — it fits what you're trying to do better than ${current.name}.` };
      }
      // Intended upsell blocked by suitability → stay put, explain honestly, never push the credit product.
      return { ...base, direction: "same", blocked_reason: suit.reason,
        reason: `Staying with ${current.name} for now. ${suit.reason}` };
    }
  }
  if (score <= -2 && current.down) {
    const target = findProduct(current.down);
    if (target) {
      return { ...base, direction: "down", recommend_key: target.key, recommend_name: target.name, recommend_price_usd: target.price_usd,
        illustration: productIllustration(target),
        reason: `${target.name} is a better-sized start than ${current.name} given your budget and where you are — you can always move up once it's working.` };
    }
  }
  return { ...base, reason: `${current.name} looks like the right fit right now.` };
}

// ── Gate 2: review on results ───────────────────────────────────────────────────────────────────────────
export interface ResultsInput {
  currentKey: string;
  resultsUsd: number;      // the customer's REAL result on this product's metric (e.g. attributed sales)
  windowMet: boolean;      // have they completed the required commitment window?
  upsellAttempts: number;  // how many prior upsells they've declined (anti-dark-pattern cap)
  signals: FunnelSignals;
}

export function reviewOnResults(input: ResultsInput, isLive: (key: string) => boolean): Recommendation {
  const current = findProduct(input.currentKey);
  const disclosures = funnelDisclosures();
  const results = Math.max(0, Number(input.resultsUsd) || 0);
  if (!current) return { gate: "results", direction: "hold", current_key: input.currentKey, recommend_key: input.currentKey, recommend_name: null, recommend_price_usd: null, reason: "Unknown product.", disclosures };

  const base: Recommendation = {
    gate: "results", direction: "hold", current_key: current.key,
    recommend_key: current.key, recommend_name: current.name, recommend_price_usd: current.price_usd,
    reason: "", disclosures,
  };

  if (!input.windowMet) {
    return { ...base, direction: "hold", reason: `Still inside the ${current.window_days}-day window — let's keep going and let the results build before deciding anything.` };
  }

  const strong = results >= current.price_usd * strongResultMult();
  const weak = results <= current.price_usd * weakResultMult();
  const resultStr = `$${r2(results).toLocaleString()}`;

  if (strong && current.up && input.upsellAttempts < maxUpsellAttempts()) {
    const target = findProduct(current.up);
    if (target) {
      const suit = suitabilityAllows(target, input.signals, isLive);
      if (suit.ok) {
        return { ...base, direction: "up", recommend_key: target.key, recommend_name: target.name, recommend_price_usd: target.price_usd,
          reason: `${current.name} generated ${resultStr} for you — strong. ${target.name} is built to scale that.` };
      }
      return { ...base, direction: "hold", blocked_reason: suit.reason,
        reason: `Great results (${resultStr}). Holding at ${current.name}. ${suit.reason}` };
    }
  }
  if (weak && current.down) {
    const target = findProduct(current.down);
    if (target) {
      return { ...base, direction: "down", recommend_key: target.key, recommend_name: target.name, recommend_price_usd: target.price_usd,
        reason: `${current.name} only returned ${resultStr} for you so far — it isn't paying off at this tier. Let's right-size to ${target.name} so you're not overpaying while we build it back up.` };
    }
  }
  return { ...base, direction: "hold", reason: `${current.name} returned ${resultStr} — middling. Let's optimize and give it another cycle before changing tiers.` };
}

export function funnelDisclosures(): string[] {
  return [
    "You're chatting with an automated assistant. Its recommendations are suggestions — you can say no or pick anything you like.",
    "Results shown are your own actual figures, not projections or typical-customer claims.",
    "It will never sign you up for a credit product unless ability-to-repay is confirmed, and it won't keep pushing after you decline.",
  ];
}
