// agent-guardrails.ts — the shared safety framework for the platform's ADVISORY agents (the scaling advisor and
// the maintenance agent are the two callers). It exists so both agents inherit ONE set of rules instead of each
// re-implementing them: every proposal an agent makes is classified into an action-class, and a single gate
// decides whether that proposal may be applied automatically, only with a human's approval, or never by an agent
// at all. The rules here are deliberately conservative — the default for anything it can't positively classify as
// reversible-and-harmless is "a human decides."
//
// This module is PURE (no I/O) so it is fully unit-testable and auditable. The functions that actually write to
// the DB or invoke an LLM live in the individual agent functions; this file only decides what is ALLOWED.

export type Severity = "info" | "warn" | "critical";

/** What an agent is permitted to do about a finding:
 *  - observe:        informational only; there is nothing to "apply".
 *  - auto_safe:      reversible, non-sensitive, self-contained (e.g. re-queue a stuck non-money job, clear a
 *                    cache, re-run a missed scheduler task). May be auto-applied ONLY if the operator has turned
 *                    on auto-apply; otherwise it still waits for a human.
 *  - needs_approval: real data changes that are recoverable but shouldn't happen unattended (e.g. soft-archive
 *                    stale records). NEVER auto-applied — always requires an explicit human confirm.
 *  - manual_only:    the agent must NEVER perform this. Money, balances, payouts, tax, KYC, credentials/secrets,
 *                    security settings, code changes, and any hard delete live here. The agent only FLAGS it; a
 *                    human does it. */
export type ActionClass = "observe" | "auto_safe" | "needs_approval" | "manual_only";

export interface AgentProposal {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  actionClass: ActionClass;
  /** machine-readable action the apply endpoint understands, e.g. "requeue_job" | "rerun_scheduler" |
   *  "soft_archive" | "clear_cache" | "none". */
  suggestedAction: string;
  /** optional target for an apply endpoint — the entity/id the action would touch. */
  target?: { entity?: string; id?: string };
  evidence?: string;
}

// ── Hard denylist ───────────────────────────────────────────────────────────────────────────────────────────
// Any proposal whose action or target trips one of these is forced to manual_only, no matter what an agent (or an
// LLM suggestion, or a body field) asked for. This is the single line that keeps an "AI maintaining the site"
// from ever touching value, identity, secrets, security, or code on its own.
const MANUAL_ONLY_PATTERNS = [
  /pay(out|ment)?/i, /transfer/i, /withdraw|deposit/i, /balance/i, /wallet/i, /refund/i, /charge/i, /invoice/i,
  /credit|debit/i, /advance/i, /reward.*(grant|adjust)|grant.*reward/i, /site.?cash/i, /tax|1099|w-?9/i,
  /kyc|identity|ssn|passport/i, /credential|secret|api.?key|token|password|oauth/i,
  /security|permission|role|admin.*(grant|promote)/i, /\bdelete\b|hard.?delete|purge|drop|truncate/i,
  /deploy|rewrite|patch.*code|migrate|schema/i,
];

/** Entities an auto/approved apply is allowed to touch. Everything money/identity/security is intentionally
 *  absent, so even a mis-classified proposal can't be applied against them. */
export const APPLY_ENTITY_ALLOWLIST = new Set<string>([
  "VideoPipelineRun", "AdvertiserApplication", "AdCreativeTest", "AffiliateContentSchedule",
  "AIActivityLog", "FunnelEmailLog", "NotificationOutbox", "CatalogListing", "AdListing",
]);

const isManualOnly = (s: string) => MANUAL_ONLY_PATTERNS.some((re) => re.test(s || ""));

/** Force a proposal down to its safest defensible class. Never UPGRADES trust — only clamps it. A proposal that
 *  mentions anything on the denylist (in its action, title, or target entity) becomes manual_only. */
export function classifyProposal(p: AgentProposal): AgentProposal {
  const probe = `${p.suggestedAction} ${p.title} ${p.target?.entity ?? ""}`;
  if (p.actionClass === "manual_only" || isManualOnly(probe)) {
    return { ...p, actionClass: "manual_only" };
  }
  // An apply-style action against an entity not on the allowlist can't be auto/approved-applied — downgrade to
  // needs_approval at most, and to manual_only if it's a write we don't recognize.
  if ((p.actionClass === "auto_safe" || p.actionClass === "needs_approval")) {
    const ent = p.target?.entity;
    if (ent && !APPLY_ENTITY_ALLOWLIST.has(ent)) return { ...p, actionClass: "manual_only" };
  }
  return p;
}

export interface GuardContext {
  autoApplyEnabled: boolean;   // operator turned on auto-apply for the auto_safe class
  humanConfirmed: boolean;     // a human explicitly approved THIS apply
}

export interface GuardResult { allowed: boolean; reason: string; }

/** The one gate every apply goes through. Decides if a proposal may be executed right now. */
export function guardApply(proposal: AgentProposal, ctx: GuardContext): GuardResult {
  const p = classifyProposal(proposal);   // always re-clamp before deciding — never trust the caller's class
  switch (p.actionClass) {
    case "manual_only":
      return { allowed: false, reason: "Manual only — this touches money, identity, secrets, security, or code, or is a destructive delete. A human must perform it; the agent will not." };
    case "observe":
      return { allowed: false, reason: "Nothing to apply — informational only." };
    case "needs_approval":
      return ctx.humanConfirmed
        ? { allowed: true, reason: "Approved by a human." }
        : { allowed: false, reason: "Needs explicit human approval before it can be applied." };
    case "auto_safe":
      if (ctx.humanConfirmed) return { allowed: true, reason: "Approved by a human." };
      return ctx.autoApplyEnabled
        ? { allowed: true, reason: "Auto-safe and operator has auto-apply enabled." }
        : { allowed: false, reason: "Auto-safe, but auto-apply is off — waiting for a human or for auto-apply to be enabled." };
    default:
      return { allowed: false, reason: "Unknown action class — refusing by default." };
  }
}

/** Convenience: can this proposal be applied WITHOUT a human, given the operator's auto-apply setting? */
export function canAutoApply(proposal: AgentProposal, autoApplyEnabled: boolean): boolean {
  return guardApply(proposal, { autoApplyEnabled, humanConfirmed: false }).allowed;
}

const SEV_RANK: Record<Severity, number> = { critical: 3, warn: 2, info: 1 };

/** Sort proposals most-urgent first (critical → warn → info), stable within a severity. Pure. */
export function prioritize(proposals: AgentProposal[]): AgentProposal[] {
  return [...proposals].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
}

/** Roll a set of findings into one overall status for a dashboard/report header. */
export function overallStatus(proposals: AgentProposal[]): "healthy" | "attention" | "critical" {
  if (proposals.some((p) => p.severity === "critical")) return "critical";
  if (proposals.some((p) => p.severity === "warn")) return "attention";
  return "healthy";
}
