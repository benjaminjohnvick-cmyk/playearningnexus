// autonomy-gate.ts — the in-process reusable GATE that routes any operational action through the Autonomy
// Kernel so it can EARN autonomy.
//
// A caller wraps its action in gateAndRun("<domain>", proposal, () => doTheThing()). The gate:
//   1. computes the domain's LIVE trust from stored history (approved runs, agreement, data),
//   2. asks the kernel whether it may act now (autonomyDecision), also honoring the global live/kill/pause
//      brake and the action's reversibility,
//   3. EITHER runs the action and records it as an auto-applied, reversible AutonomyDecision (+ live feed),
//      OR queues it for the human overseer (AutonomyDecision awaiting_approval + an AutomationReview inbox row).
// Either path records an AutonomyDecision, so every gated action feeds the trust ledger and the domain
// graduates on the same rules everywhere. Fail-CLOSED: any internal error → not executed (pending), never throws.
//
// This is the plumbing that lets more of the platform become autonomous over time WITHOUT weakening the spine:
// permanent_gate domains (money/identity/legal/risk) and irreversible actions never auto-run here, no matter
// how much trust exists — same wall the kernel enforces.

import { db } from "./db.ts";
import {
  domainById, resolvePolicy, computeAgreement, autonomyDecision, currentThresholds,
  autonomyKillSwitch, autonomyAutoOkDefault,
} from "./autonomy-kernel.ts";
import { logAiAction } from "./ai-control.ts";
import { canAutoApplyNonSensitiveAsync } from "./ai-autonomy.ts";

export interface GateProposal {
  subjectId?: string;                    // what the action touches (id), for the ledger + overseer inbox
  summary: string;                       // one-line human-readable description
  caps?: Record<string, unknown>;        // budget/rate caps that bound the action (always enforced by caller)
  reversible?: boolean;                  // default true; an irreversible action NEVER auto-runs even at 'full'
  undoRef?: string;                      // handle the overseer can use to reverse an auto-applied action
  proposal?: Record<string, unknown>;    // structured detail of what would be done
}

export interface GateResult<T> {
  executed: boolean; pending: boolean; auto_approve: boolean;
  reason: string; mode: string; permanent_gate: boolean;
  decision_id: string | null; result?: T; error?: string;
}

// ── pure classifier (unit-tested) ───────────────────────────────────────────────────────────────────────
export interface GateInputs { auto_approve: boolean; permanent_gate: boolean; reversible: boolean; globalOpen: boolean; kernelReason: string; }
/** The whole gate rule in one pure function: permanent gate and irreversibility are hard walls; then the global
 *  brake; then the kernel's own auto/earned/manual decision. */
export function classifyGate(i: GateInputs): { mayRun: boolean; reason: string } {
  if (i.permanent_gate) return { mayRun: false, reason: "permanent human/counsel gate — money, identity, legal or risk" };
  if (!i.reversible) return { mayRun: false, reason: "irreversible action — human required" };
  if (!i.globalOpen) return { mayRun: false, reason: "global gate closed (advisory / paused / kill switch)" };
  if (!i.auto_approve) return { mayRun: false, reason: i.kernelReason };
  return { mayRun: true, reason: i.kernelReason };
}

// ── live trust computation for one domain (shared shape with autonomyDecide) ──────────────────────────────
export interface DomainTrust {
  policy: ReturnType<typeof resolvePolicy>;
  decision: ReturnType<typeof autonomyDecision>;
  signals: { approvedRuns: number; agreementRate: number; dataSample: number; humanDecisions: number };
}
export async function decideDomain(domainId: string): Promise<DomainTrust> {
  const [override, decisions, fbCount] = await Promise.all([
    db.filter("AutonomyDomain", { domain_id: domainId }, "-created_at", 1).catch(() => []) as Promise<Record<string, unknown>[]>,
    db.filter("AutonomyDecision", { domain: domainId }, "-created_at", 2000).catch(() => []) as Promise<Record<string, unknown>[]>,
    db.count("FeedbackEvent", { domain: domainId }).catch(() => 0),
  ]);
  const policy = resolvePolicy(domainId, override?.[0]?.mode as string | undefined, autonomyAutoOkDefault());
  const agree = computeAgreement((decisions || []).map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
  const dataSample = (Number(fbCount) || 0) + (decisions?.length || 0);
  const decision = autonomyDecision(policy, { approvedRuns: agree.approvedRuns, agreementRate: agree.agreementRate, dataSample }, currentThresholds(), autonomyKillSwitch());
  return { policy, decision, signals: { approvedRuns: agree.approvedRuns, agreementRate: agree.agreementRate, dataSample, humanDecisions: agree.humanDecisions } };
}

/** Gate an operational action through the kernel and, if allowed, RUN it. Records an AutonomyDecision either
 *  way; queues an AutomationReview for the overseer when a human is required. Never throws — fails CLOSED. */
export async function gateAndRun<T>(domainId: string, p: GateProposal, run: () => Promise<T>): Promise<GateResult<T>> {
  const now = new Date().toISOString();
  if (!domainById(domainId)) {
    return { executed: false, pending: false, auto_approve: false, reason: "unknown domain", mode: "manual", permanent_gate: false, decision_id: null, error: "unknown_domain" };
  }
  try {
    const { policy, decision } = await decideDomain(domainId);
    const reversible = p.reversible !== false;
    const globalOpen = await canAutoApplyNonSensitiveAsync().catch(() => false);
    const cls = classifyGate({ auto_approve: decision.auto_approve, permanent_gate: policy.permanent_gate, reversible, globalOpen, kernelReason: decision.reason });

    if (cls.mayRun) {
      let result: T | undefined; let ranOk = true; let errMsg = "";
      try { result = await run(); } catch (e) { ranOk = false; errMsg = String((e as Error)?.message || e); }
      const row = await db.create("AutonomyDecision", {
        domain: domainId, subject_id: p.subjectId ? String(p.subjectId).slice(0, 120) : null,
        proposal: p.proposal ?? null, caps: p.caps ?? null,
        stage: ranOk ? "applied" : "failed", auto_approved: true, decided: "approved", tweaked: false,
        reversible, undo_ref: p.undoRef ?? null, executed: ranOk, error: ranOk ? null : errMsg.slice(0, 300),
        mode: policy.mode, reason: cls.reason, permanent_gate: false, created_at: now, updated_at: now,
      }).catch(() => null) as Record<string, unknown> | null;
      await logAiAction({
        agent: `autonomy:${domainId}`, action: "auto_apply", target: p.subjectId ?? domainId,
        status: ranOk ? "applied" : "failed", reversible, summary: p.summary,
        detail: { reason: cls.reason, undo_ref: p.undoRef ?? null, error: ranOk ? undefined : errMsg.slice(0, 300) },
      }).catch(() => null);
      return { executed: ranOk, pending: false, auto_approve: true, reason: cls.reason, mode: policy.mode, permanent_gate: false, decision_id: (row?.id as string) ?? null, result, error: ranOk ? undefined : errMsg };
    }

    // Human required: record awaiting_approval + mirror into the overseer inbox.
    const row = await db.create("AutonomyDecision", {
      domain: domainId, subject_id: p.subjectId ? String(p.subjectId).slice(0, 120) : null,
      proposal: p.proposal ?? null, caps: p.caps ?? null,
      stage: "awaiting_approval", auto_approved: false, decided: null, tweaked: false,
      reversible, undo_ref: p.undoRef ?? null, executed: false,
      mode: policy.mode, reason: cls.reason, permanent_gate: policy.permanent_gate, created_at: now, updated_at: now,
    }).catch(() => null) as Record<string, unknown> | null;
    await db.create("AutomationReview", {
      type: "agent_action", status: "pending_approval", domain: domainId, decision_id: (row?.id as string) ?? null,
      subject_id: p.subjectId ?? null, summary: p.summary, reason: cls.reason, reversible,
      permanent_gate: policy.permanent_gate, created_at: now,
    }).catch(() => null);
    await logAiAction({
      agent: `autonomy:${domainId}`, action: "queue_for_review", target: p.subjectId ?? domainId,
      status: "queued", reversible, summary: p.summary, detail: { reason: cls.reason },
    }).catch(() => null);
    return { executed: false, pending: true, auto_approve: false, reason: cls.reason, mode: policy.mode, permanent_gate: policy.permanent_gate, decision_id: (row?.id as string) ?? null };
  } catch (e) {
    return { executed: false, pending: false, auto_approve: false, reason: "gate error — not executed", mode: "manual", permanent_gate: false, decision_id: null, error: String((e as Error)?.message || e) };
  }
}
