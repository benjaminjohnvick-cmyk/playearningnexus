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
  note?: string;
}

// The initial domain map. auto_ok domains can graduate; permanent_gate domains never do (compliance spine).
export const DOMAINS: DomainDef[] = [
  // ── auto_ok: safe, reversible, high-volume — graduate on data ──
  { id: "video", label: "Video creative", group: "content", klass: "auto_ok", default_mode: "manual", note: "Reference implementation (video autopilot)." },
  { id: "creative", label: "Ad creative", group: "content", klass: "auto_ok", default_mode: "manual" },
  { id: "social", label: "Social posts", group: "content", klass: "auto_ok", default_mode: "manual" },
  { id: "survey", label: "Survey design", group: "content", klass: "auto_ok", default_mode: "manual" },
  { id: "recommendation", label: "Recommendations / personalization", group: "revenue", klass: "auto_ok", default_mode: "manual" },
  { id: "pricing_experiment", label: "Pricing experiments", group: "revenue", klass: "auto_ok", default_mode: "manual", note: "Experiments only — not live price changes without a gate." },
  { id: "catalog", label: "Catalog / merchandising", group: "revenue", klass: "auto_ok", default_mode: "manual" },
  { id: "matching", label: "Survey / offer matching", group: "ops", klass: "auto_ok", default_mode: "manual" },
  { id: "onboarding", label: "Onboarding flows", group: "ops", klass: "auto_ok", default_mode: "manual" },
  { id: "support_answer", label: "Support answer drafts", group: "ops", klass: "auto_ok", default_mode: "manual" },
  // ── permanent_gate: money / identity / legal / risk — NEVER auto ──
  { id: "payout", label: "Payouts / withdrawals", group: "money", klass: "permanent_gate", note: "Money out — money-transmission risk. AI prepares; human releases." },
  { id: "refund", label: "Refunds (above threshold)", group: "money", klass: "permanent_gate" },
  { id: "billing_change", label: "Billing / subscription changes", group: "money", klass: "permanent_gate", note: "Negative-option-billing risk — counsel-gated." },
  { id: "kyc_tax", label: "KYC / tax (W-9 / 1099)", group: "identity", klass: "permanent_gate" },
  { id: "dispute", label: "Disputes / chargebacks", group: "risk", klass: "permanent_gate" },
  { id: "account_action", label: "Bans / account actions", group: "risk", klass: "permanent_gate" },
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
