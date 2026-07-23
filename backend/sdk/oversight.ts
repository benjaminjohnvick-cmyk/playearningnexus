// Human-in-the-loop oversight gate for agent / automation actions.
//
// Operating model: **AI proposes, survey data justifies, a human disposes.**
// This reuses your EXISTING pieces — the `AutomationReview` entity is the approval
// queue, and `AppLog` is the audit trail — so nothing new needs to be built to see or
// act on proposals. Low-risk actions auto-execute (and are audit-logged); critical/high
// actions are queued for a human and DO NOT execute until approved. Behaviour is tuned
// entirely in `sdk/risk-policy.json` — no code change to re-tier an action or to let
// small payouts auto-clear once the agents have earned trust.
//
// Usage inside any function (e.g. paypalPayout):
//   import { gate } from "../../sdk/oversight.ts";
//   const g = await gate({ action: "paypalPayout", amount, agent, summary, payload: body,
//                          evidence, approvalToken: body.approvalToken });
//   if (!g.proceed) return Response.json({ gated: true, status: "pending_approval",
//                                          reviewId: g.reviewId }, { status: 202 });
//   // ...otherwise execute as normal...
import { db } from "./db.ts";

type Policy = {
  autoApproveMoneyUnder: number;
  critical: string[];
  high: string[];
  sensitiveEntities: string[];
};
const policy: Policy = JSON.parse(
  await Deno.readTextFile(new URL("./risk-policy.json", import.meta.url)),
);

export const SENSITIVE_ENTITIES = new Set(policy.sensitiveEntities);

export type ActionInput = {
  action: string; // e.g. "paypalPayout", "banUser", or an entity name for agent writes
  amount?: number; // money amount, if any
  agent?: string; // proposing agent / function
  summary: string; // human-readable what + why
  payload: Record<string, unknown>; // exact args to execute on approval
  evidence?: unknown; // survey signals / data behind the decision
  approvalToken?: string; // set when re-invoked after a human approves
};

// Re-entrancy guard: while an already-approved action is executing (re-invoked by
// oversightApprove), any nested gated sub-step it triggers should NOT ask for approval
// again — the human already approved this action and everything it does. oversightApprove
// wraps its re-invocation in runApproved().
let _approvedDepth = 0;
export async function runApproved<T>(fn: () => Promise<T>): Promise<T> {
  _approvedDepth++;
  try {
    return await fn();
  } finally {
    _approvedDepth--;
  }
}

export function tierFor(action: string): "critical" | "high" | "low" {
  const a = (action || "").toLowerCase();
  if (policy.critical.some((p) => a.includes(p))) return "critical";
  if (policy.high.some((p) => a.includes(p))) return "high";
  return "low";
}

/** Whether an action must wait for a human, given the policy + any money amount. */
export function needsApproval(action: string, amount = 0): boolean {
  const t = tierFor(action);
  if (t === "critical") return true; // money / account / irreversible: always
  if (t === "high") return amount === 0 || amount >= (policy.autoApproveMoneyUnder ?? 0);
  return false; // low: auto
}

async function audit(event: string, input: ActionInput, reviewId?: string, actor?: string | null) {
  try {
    await db.create("AppLog", {
      source: "oversight",
      event, // queued_for_approval | auto_executed | executed_after_approval
      action: input.action,
      agent: input.agent ?? "system",
      amount: input.amount ?? null,
      review_id: reviewId ?? null,
      actor: actor ?? null,
      summary: input.summary,
      at: new Date().toISOString(),
    });
  } catch { /* audit is best-effort; never block the action on a log failure */ }
}

/**
 * The gate. Call at the top of any sensitive action.
 *   { proceed: true }              → caller may execute now (low-risk, or already approved)
 *   { proceed: false, reviewId }   → a pending approval was created; caller MUST stop
 */
export async function gate(
  input: ActionInput,
): Promise<{ proceed: boolean; reviewId?: string }> {
  // Inside an already-approved execution → its sub-steps proceed without re-prompting.
  if (_approvedDepth > 0) {
    await audit("auto_within_approved", input);
    return { proceed: true };
  }

  // Already approved? (the oversight approve step re-invokes with this token.)
  if (input.approvalToken) {
    const rev = await db.get("AutomationReview", input.approvalToken).catch(() => null);
    if (rev && rev.status === "approved" && rev.action === input.action) {
      await audit("executed_after_approval", input, rev.id, rev.approved_by ?? null);
      return { proceed: true, reviewId: rev.id };
    }
  }

  if (!needsApproval(input.action, input.amount ?? 0)) {
    await audit("auto_executed", input);
    return { proceed: true };
  }

  // Queue for a human and stop. This record shows up in the existing
  // AutomationReviewDashboard / AutomationGuardianDashboard.
  const review = await db.create("AutomationReview", {
    type: "agent_action",
    action: input.action,
    agent: input.agent ?? "system",
    status: "pending_approval",
    risk_tier: tierFor(input.action),
    amount: input.amount ?? null,
    summary: input.summary,
    payload: input.payload,
    evidence: input.evidence ?? null,
    requested_at: new Date().toISOString(),
  });
  await audit("queued_for_approval", input, review.id);
  return { proceed: false, reviewId: review.id };
}
