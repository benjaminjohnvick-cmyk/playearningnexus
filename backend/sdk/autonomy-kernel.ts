// autonomy-kernel.ts — the ONE reusable engine that lets any process across the platform graduate from
// human-in-the-loop to full AI autonomy on the same trust rules (generalizes sdk/video-autopilot.ts).
//
// Every automatable decision belongs to a DOMAIN. A domain is either:
//   • "auto_ok"        — safe, reversible, high-volume. It starts human-gated and EARNS autonomy from data
//                         (enough approved decisions + high agreement with the human + a deep-enough playbook).
//   • "permanent_gate" — money / identity / legal / risk. It NEVER auto-approves, no matter how much data
//                         exists, because the risk is legal & irreversible, not a matter of confidence. AI
//                         still does the work and recommends; a human (and, where needed, counsel) taps once.
//
// This module is the pure, deterministic, unit-tested core: the registry, trust math, and the gate decision.
// Budget/rate caps live per-domain and ALWAYS apply — autonomy decides WHETHER to act, never how much.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export type Autonomy = "manual" | "earned" | "full";
export type DomainClass = "auto_ok" | "permanent_gate";

export interface DomainDef {
  id: string;
  label: string;
  group: string;                 // content | revenue | ops | money | identity | risk | legal
  klass: DomainClass;
  default_mode: Autonomy;        // starting autonomy for auto_ok domains (permanent_gate is always manual)
  gateable?: boolean;            // true = this domain has a discrete, reversible, autonomous action routed
                                 //        through gateAndRun (it counts toward the "loop routed" coverage).
                                 //        Read-only (reporting/monitoring), on-demand, run-at-signup, or
                                 //        separately-governed domains (e.g. video autopilot) are NOT gateable.
  wired?: boolean;               // true = the code actually routes an action through the gate today. Coverage =
                                 //        wired gateable / total gateable, so it reflects real wiring, not runtime.
  note?: string;
}

// The initial domain map. auto_ok domains can graduate; permanent_gate domains never do (compliance spine).
export const DOMAINS: DomainDef[] = [
  // ── auto_ok: safe, reversible, high-volume — graduate on data ──
  // `gateable` = has a discrete, reversible, autonomous action routed through gateAndRun (counts toward
  // "loop routed" coverage). Non-gateable auto_ok domains are excluded from coverage WITH a reason, because
  // gating them would be theater: read-only reporting/monitoring, on-demand/user-initiated actions,
  // run-at-signup flows, or work governed by a separate mechanism (video autopilot).
  { id: "video", label: "Video creative", group: "content", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Governed by the dedicated video-autopilot graduated-autonomy mechanism (separate)." },
  { id: "creative", label: "Ad creative", group: "content", klass: "auto_ok", default_mode: "manual", gateable: false, note: "On-demand, user-initiated generation with its own quota/caps + AI-disclosure gate." },
  { id: "social", label: "Social posts", group: "content", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Distribution gated by explicit member opt-in + FTC #ad consent (its own gate)." },
  { id: "survey", label: "Survey design / distribution", group: "content", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true },
  { id: "recommendation", label: "Recommendations / personalization", group: "revenue", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Covered by the personalization_home domain (same recommendation write)." },
  { id: "pricing_experiment", label: "Pricing experiments", group: "revenue", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Runs under the experiment + global-review promotion flow; live prices stay gated." },
  { id: "catalog", label: "Catalog / merchandising", group: "revenue", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true },
  { id: "matching", label: "Survey / offer matching", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Continuous ranking, no discrete apply to gate." },
  { id: "onboarding", label: "Onboarding flows", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Runs at signup; must be immediate, not queued behind approval." },
  { id: "support_answer", label: "Support answer drafts", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Drafts only — a human sends the reply." },
  // ── auto_ok expansion: the operational loop of "running the business" — reversible, bounded, high-volume ──
  { id: "ad_optimization", label: "Ad delivery optimization (within budget caps)", group: "revenue", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true, note: "Reallocates delivery INSIDE fixed budget/rate caps — never raises spend (that's a gate)." },
  { id: "content_calendar", label: "Content calendar scheduling", group: "content", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true },
  { id: "seo_metadata", label: "SEO metadata & on-page copy", group: "content", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true, note: "AI SEO / AI-search generation (seoGenerateMetadata) routes through here." },
  { id: "personalization_home", label: "Homepage / feed personalization", group: "revenue", klass: "auto_ok", default_mode: "manual", gateable: true, wired: true },
  { id: "analytics_report", label: "Analytics & performance reporting", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Read-only reporting — no user-facing state change to gate." },
  { id: "doc_generation", label: "Internal document & report generation", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Internal drafts; report content already routes via the document model job. No user-facing apply." },
  { id: "ops_monitor", label: "Infra / anomaly monitoring & suggestions", group: "ops", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Read-only monitoring; suggestions only. Changing config is gated (security_config)." },
  { id: "moderation_triage", label: "Content moderation triage (flag & queue)", group: "risk", klass: "auto_ok", default_mode: "manual", gateable: false, note: "Enforcement (hide/remove) belongs to account_action gate; pure flag/queue has no separate autonomous apply." },
  // ── permanent_gate: money / identity / legal / risk — NEVER auto ──
  { id: "payout", label: "Payouts / withdrawals", group: "money", klass: "permanent_gate", note: "Money out — money-transmission risk. AI prepares; human releases." },
  { id: "refund", label: "Refunds (above threshold)", group: "money", klass: "permanent_gate" },
  { id: "billing_change", label: "Billing / subscription changes", group: "money", klass: "permanent_gate", note: "Negative-option-billing risk — counsel-gated." },
  { id: "advertiser_billing", label: "Advertiser pricing / billing changes", group: "money", klass: "permanent_gate", note: "What advertisers are charged — money & contract terms." },
  { id: "kyc_tax", label: "KYC / tax (W-9 / 1099)", group: "identity", klass: "permanent_gate" },
  { id: "data_sharing", label: "External data sharing / exports", group: "identity", klass: "permanent_gate", note: "Sharing user data with third parties — privacy-gated (GDPR/CCPA)." },
  { id: "dispute", label: "Disputes / chargebacks", group: "risk", klass: "permanent_gate" },
  { id: "account_action", label: "Bans / account actions", group: "risk", klass: "permanent_gate" },
  { id: "security_config", label: "Security / infra configuration changes", group: "risk", klass: "permanent_gate", note: "Prohibited-action class — human only, never delegated to the model." },
  { id: "legal_content", label: "Legal / public terms & claims", group: "legal", klass: "permanent_gate" },
];

export const domainById = (id: string): DomainDef | undefined => DOMAINS.find((d) => d.id === id);
export const isPermanentGate = (id: string): boolean => domainById(id)?.klass === "permanent_gate";

// ── global switches + trust thresholds (numbers MUST be registered in settings.ts) ──────────────────────
export const autonomyEnabled = () => snapBool("AUTONOMY_ENABLED", true);
/** The master brake: when true, NOTHING auto-approves anywhere (everything falls back to the human gate). */
export const autonomyKillSwitch = () => snapBool("AUTONOMY_KILL_SWITCH", false);
export const trustMinRuns = () => Math.max(0, Math.round(snapNumber("AUTONOMY_TRUST_MIN_RUNS", 10)));
export const trustMinAgreement = () => Math.min(1, Math.max(0, snapNumber("AUTONOMY_TRUST_MIN_AGREEMENT", 0.8)));
export const trustMinData = () => Math.max(0, Math.round(snapNumber("AUTONOMY_TRUST_MIN_DATA", 200)));

const asMode = (v: unknown): Autonomy | null => {
  const m = String(v ?? "").trim().toLowerCase();
  return (m === "manual" || m === "earned" || m === "full") ? (m as Autonomy) : null;
};

/** Owner-delegated default autonomy for the NON-SENSITIVE (auto_ok) domains that have no explicit per-domain
 *  override. permanent_gate domains ignore this entirely — they are always "manual". Settings-backed (impure);
 *  pass its result into resolvePolicy so the resolver itself stays pure/testable. */
export const autonomyAutoOkDefault = (): Autonomy => asMode(snapString("AUTONOMY_AUTO_OK_DEFAULT_MODE", "full")) ?? "full";

export interface Policy { domain: DomainDef; mode: Autonomy; permanent_gate: boolean; }

/** Resolve a domain's live policy: its class + the effective autonomy mode. For auto_ok domains the mode is
 *  the stored per-domain override (from the Command Center) if valid, else `autoOkDefaultMode` if valid, else
 *  the domain's own default. permanent_gate domains are forced to "manual" no matter what is stored. Pure —
 *  callers pass autonomyAutoOkDefault() for the owner-delegated default. */
export function resolvePolicy(id: string, overrideMode?: string | null, autoOkDefaultMode?: Autonomy | string | null): Policy {
  const domain = domainById(id) ?? { id, label: id, group: "other", klass: "auto_ok", default_mode: "manual" };
  if (domain.klass === "permanent_gate") return { domain, mode: "manual", permanent_gate: true };
  const mode: Autonomy = asMode(overrideMode) ?? asMode(autoOkDefaultMode) ?? domain.default_mode;
  return { domain, mode, permanent_gate: false };
}

// ── trust / agreement (identical shape to the video reference so histories are comparable) ──────────────
export interface Decision { decided?: string; tweaked?: boolean; auto_approved?: boolean; }
export function computeAgreement(decisions: Decision[]): { approvedRuns: number; cleanApprovals: number; humanDecisions: number; agreementRate: number } {
  const human = (decisions || []).filter((d) => d.auto_approved !== true && (d.decided === "approved" || d.decided === "rejected"));
  const approvedRuns = human.filter((d) => d.decided === "approved").length;
  const cleanApprovals = human.filter((d) => d.decided === "approved" && !d.tweaked).length;
  const humanDecisions = human.length;
  return { approvedRuns, cleanApprovals, humanDecisions, agreementRate: humanDecisions ? cleanApprovals / humanDecisions : 0 };
}

export interface TrustSignals { approvedRuns: number; agreementRate: number; dataSample: number; }
export interface TrustThresholds { minRuns: number; minAgreement: number; minData: number; }

/** The gate decision for one domain. permanent_gate → never auto. kill switch → never auto. Otherwise:
 *  "full" always auto; "manual" never; "earned" auto only when every trust bar is cleared. Returns the reason
 *  and per-bar progress for the UI. Pure. */
export function autonomyDecision(
  policy: Policy, t: TrustSignals, thr: TrustThresholds, killSwitch = false,
): { auto_approve: boolean; earned: boolean; reason: string; progress: { runs: [number, number]; agreement: [number, number]; data: [number, number] } } {
  const progress = {
    runs: [t.approvedRuns, thr.minRuns] as [number, number],
    agreement: [Math.round(t.agreementRate * 100) / 100, thr.minAgreement] as [number, number],
    data: [t.dataSample, thr.minData] as [number, number],
  };
  const okRuns = t.approvedRuns >= thr.minRuns;
  const okAgree = t.agreementRate >= thr.minAgreement;
  const okData = t.dataSample >= thr.minData;
  const earned = okRuns && okAgree && okData;

  if (policy.permanent_gate) return { auto_approve: false, earned: false, reason: "permanent human/counsel gate — money, identity, legal or risk", progress };
  if (killSwitch) return { auto_approve: false, earned, reason: "global kill switch is ON — everything requires a human", progress };
  if (policy.mode === "full") return { auto_approve: true, earned, reason: "full autonomy (owner-delegated)", progress };
  if (policy.mode === "manual") return { auto_approve: false, earned, reason: "manual approval required", progress };
  if (earned) return { auto_approve: true, earned, reason: "trust earned — auto-approving within caps", progress };
  const need: string[] = [];
  if (!okRuns) need.push(`${t.approvedRuns}/${thr.minRuns} approved`);
  if (!okAgree) need.push(`${Math.round(t.agreementRate * 100)}%/${Math.round(thr.minAgreement * 100)}% agreement`);
  if (!okData) need.push(`${t.dataSample}/${thr.minData} data`);
  return { auto_approve: false, earned, reason: `earning trust — still need: ${need.join(", ")}`, progress };
}

/** Convenience: the current global thresholds from settings. */
export const currentThresholds = (): TrustThresholds => ({ minRuns: trustMinRuns(), minAgreement: trustMinAgreement(), minData: trustMinData() });
