// feedback.ts — ONE standard feedback event for every customer-interaction surface on the site, and the
// bridge that turns it into a learning signal the autonomy kernel trains on. Drop a feedback capture into any
// surface (a thumbs, a rating, a poll, or an implicit conversion/watch signal) and it feeds the same
// substrate, so every surface both invites feedback AND improves the AI that runs it.
//
// Pure helpers here (normalize, map to a signed weight, aggregate) are unit-tested; the DB bridge writes a
// FeedbackEvent row + an OptimizationSignal so the kernel and the per-domain playbooks can learn from it.

import { snapBool, snapNumber } from "./settings.ts";

export const feedbackEnabled = () => snapBool("FEEDBACK_ENABLED", true);
export const autoCollectEnabled = () => snapBool("FEEDBACK_AUTOCOLLECT_ENABLED", true);

/** Map a customer-facing surface (a page name or feature area) to the autonomy DOMAIN it trains, by keyword.
 *  This is what lets the AI auto-attribute passively-collected behavior (dwell, conversion, friction) on any
 *  of the site's pages to the right learning loop — with no user asked anything. Returns null to skip. Pure. */
export function domainForSurface(surface: string): string | null {
  const s = String(surface || "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/video/, "video"],
    [/social/, "social"],
    [/survey|poll|quiz/, "survey"],
    [/shop|store|catalog|product|market|buy|checkout|cart|order/, "catalog"],
    [/recommend|for[-_ ]?you|feed|discover|match|personal/, "recommendation"],
    [/\bad(s|grid|campaign|creative)?\b|creative|campaign/, "creative"],
    [/onboard|sign[-_ ]?up|apply|welcome|getstarted/, "onboarding"],
    [/support|help|contact|faq|assistant|concierge/, "support_answer"],
    [/pric|offer|deal|bundle/, "pricing_experiment"],
  ];
  for (const [re, d] of rules) if (re.test(s)) return d;
  return null;
}

// The kinds of feedback any surface can emit. explicit = the user told us; implicit = we observed it.
export type FeedbackKind =
  | "thumb"          // up/down          → value: 1 | -1
  | "rating"         // 1..5 stars       → value: 1..5
  | "nps"            // 0..10            → value: 0..10
  | "choice"        // A/B / poll pick   → value: +1 for the chosen, handled by the poll layer
  | "helpful"        // yes/no           → value: 1 | 0
  | "conversion"     // did/didn't act   → value: 1 | 0  (implicit)
  | "completion"     // finished/not     → value: 0..1   (implicit fraction)
  | "dwell"          // engagement time  → value: seconds (implicit)
  | "report";        // flagged a problem → value: -1 (strong negative)

export interface FeedbackInput {
  surface: string;              // where it happened, e.g. "ConceptPolls", "AIShoppingAssistant", "SurveyRun"
  domain?: string;              // which autonomy domain it trains, e.g. "recommendation", "video", "survey"
  kind: FeedbackKind;
  value?: number;               // per-kind (see above)
  subject_id?: string;          // the thing rated (a concept id, an answer id, a recommendation id…)
  user_id?: string | null;
  comment?: string;
  meta?: Record<string, unknown>;
}

/** Normalize a raw feedback input into a bounded, well-typed record. Clamps values into their valid range and
 *  drops obviously invalid events. Pure. */
export function normalizeFeedback(f: FeedbackInput): (FeedbackInput & { value: number }) | null {
  if (!f || !f.surface || !f.kind) return null;
  let v = Number(f.value);
  if (!Number.isFinite(v)) v = 0;
  switch (f.kind) {
    case "thumb": v = v >= 0 ? 1 : -1; break;
    case "rating": v = Math.max(1, Math.min(5, Math.round(v))); break;
    case "nps": v = Math.max(0, Math.min(10, Math.round(v))); break;
    case "helpful": v = v >= 1 ? 1 : 0; break;
    case "conversion": v = v >= 1 ? 1 : 0; break;
    case "completion": v = Math.max(0, Math.min(1, v)); break;
    case "dwell": v = Math.max(0, v); break;
    case "report": v = -1; break;
    case "choice": v = v >= 0 ? 1 : -1; break;
  }
  return { ...f, value: v, comment: (f.comment || "").slice(0, 1000) };
}

/** Map a normalized feedback event to a SIGNED learning weight (positive = good, negative = bad). This is what
 *  lets a thumbs-down, a 2-star, a bounce, and a report all speak the same language to the learner. Pure. */
export function feedbackToWeight(f: { kind: FeedbackKind; value: number }): number {
  switch (f.kind) {
    case "thumb": return f.value;                       // +1 / -1
    case "rating": return (f.value - 3) / 2;            // 1..5 → -1..+1
    case "nps": return (f.value - 7) / 3;               // detractor<7 negative, promoter>7 positive
    case "helpful": return f.value ? 1 : -1;
    case "conversion": return f.value ? 1 : -0.5;       // converting is a strong positive; not, a mild negative
    case "completion": return f.value * 2 - 1;          // 0..1 → -1..+1
    case "dwell": return Math.max(-1, Math.min(1, (f.value - 15) / 30)); // longer dwell = better (centered ~15s)
    case "report": return -2;                           // strong negative
    case "choice": return f.value;                      // +1 chosen
    default: return 0;
  }
}

export interface FeedbackRow { kind: FeedbackKind; value: number; weight?: number; }

/** Aggregate a set of feedback events for a surface/subject into a headline score and counts. Pure. */
export function aggregateFeedback(rows: FeedbackRow[]): {
  count: number; net_weight: number; avg_weight: number; positives: number; negatives: number; reports: number;
} {
  let net = 0, pos = 0, neg = 0, reports = 0;
  for (const r of rows || []) {
    const w = typeof r.weight === "number" ? r.weight : feedbackToWeight(r);
    net += w;
    if (w > 0) pos++; else if (w < 0) neg++;
    if (r.kind === "report") reports++;
  }
  const count = (rows || []).length;
  return {
    count, net_weight: Math.round(net * 1000) / 1000,
    avg_weight: count ? Math.round((net / count) * 1000) / 1000 : 0,
    positives: pos, negatives: neg, reports,
  };
}

// ── DB bridge ───────────────────────────────────────────────────────────────────────────────────────────
type Dbi = { create: (name: string, doc: Record<string, unknown>) => Promise<unknown>; };

/** Persist a feedback event AND emit a learning signal so the autonomy kernel / per-domain playbooks learn.
 *  Best-effort; never throws into the caller. Returns the computed weight. */
export async function recordFeedback(dbi: Dbi, f: FeedbackInput, todayISO = ""): Promise<number> {
  const n = normalizeFeedback(f);
  if (!n) return 0;
  const weight = feedbackToWeight(n);
  const at = todayISO || new Date().toISOString();
  await dbi.create("FeedbackEvent", {
    surface: n.surface, domain: n.domain ?? null, kind: n.kind, value: n.value, weight,
    subject_id: n.subject_id ?? null, user_id: n.user_id ?? null, comment: n.comment ?? "",
    meta: n.meta ?? null, at, created_at: at,
  }).catch(() => null);
  // Also feed the shared learning substrate so domain playbooks + the kernel can read it.
  await dbi.create("OptimizationSignal", {
    kind: "feedback", key: `feedback:${n.domain ?? n.surface}`,
    surface: n.surface, domain: n.domain ?? null, feedback_kind: n.kind,
    subject_id: n.subject_id ?? null, weight, note: `feedback ${n.kind} on ${n.surface}`, created_at: at,
  }).catch(() => null);
  return weight;
}
