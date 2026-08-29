// video-autopilot.ts — the pure orchestration core for the end-to-end AI Video pipeline with a human gate.
//
// The pipeline runs the cheap, reversible stages on its own — refresh live trends → generate concepts →
// build a user poll → learn from votes → SELECT the render winners — then STOPS at a human approval gate
// BEFORE any render spend. A human approves (optionally tweaking the set) or rejects; only on approval does
// it render. This module is the deterministic state machine + gate logic; the functions (aiVideoAutopilot*)
// do the I/O by reusing the existing engine/poll functions in-process.

import { snapBool, snapNumber, snapString } from "./settings.ts";

// ── stages ──────────────────────────────────────────────────────────────────────────────────────────────
// collecting              — poll is live, gathering votes (auto-advances when ready)
// awaiting_render_approval — winners selected; WAITING FOR A HUMAN (the gate)
// rendered                 — human approved; winners rendered/queued (terminal-ish; testing/learning continue)
// cancelled                — human rejected
// error                    — a stage failed
export type AutopilotStage = "collecting" | "awaiting_render_approval" | "rendered" | "cancelled" | "error";
export const AUTOPILOT_STAGES: AutopilotStage[] = ["collecting", "awaiting_render_approval", "rendered", "cancelled", "error"];

export const HUMAN_GATE: AutopilotStage = "awaiting_render_approval";

/** Is a run parked at the human gate? */
export const needsApproval = (stage: string): boolean => stage === HUMAN_GATE;
/** Is a run finished (no more automatic movement)? */
export const isTerminal = (stage: string): boolean => stage === "rendered" || stage === "cancelled" || stage === "error";
/** Is a run still gathering votes? */
export const isCollecting = (stage: string): boolean => stage === "collecting";

// ── settings ────────────────────────────────────────────────────────────────────────────────────────────
export const autopilotEnabled = () => snapBool("VIDEO_AUTOPILOT_ENABLED", true);
export const autopilotBatchSize = () => Math.max(2, Math.round(snapNumber("VIDEO_AUTOPILOT_BATCH_SIZE", 60)));
export const autopilotMinVotes = () => Math.max(0, Math.round(snapNumber("VIDEO_AUTOPILOT_POLL_MIN_VOTES", 10)));
export const autopilotMaxCollectHours = () => Math.max(0, snapNumber("VIDEO_AUTOPILOT_MAX_COLLECT_HOURS", 24));
export const autopilotRenderLimit = () => Math.max(1, Math.round(snapNumber("VIDEO_AUTOPILOT_RENDER_LIMIT", 20)));

// ── graduated autonomy — the human gate is training wheels that come off once trust is EARNED ────────────
// "manual" = always ask a human (default). "earned" = auto-approve only once the system has proven itself
// (enough human-approved runs, high agreement with the human, deep-enough playbook). "full" = owner has fully
// delegated; always auto-approve. Budget caps ALWAYS apply regardless — autonomy never bypasses the $ ceiling.
export type Autonomy = "manual" | "earned" | "full";
export function autopilotAutonomy(): Autonomy {
  const v = (snapString("VIDEO_AUTOPILOT_AUTONOMY", "manual") || "manual").trim().toLowerCase();
  return (v === "earned" || v === "full") ? v : "manual";
}
export const trustMinRuns = () => Math.max(0, Math.round(snapNumber("VIDEO_AUTOPILOT_TRUST_MIN_RUNS", 10)));
export const trustMinAgreement = () => Math.min(1, Math.max(0, snapNumber("VIDEO_AUTOPILOT_TRUST_MIN_AGREEMENT", 0.8)));
export const trustMinPlaybook = () => Math.max(0, Math.round(snapNumber("VIDEO_AUTOPILOT_TRUST_MIN_PLAYBOOK", 200)));

export interface Decision { decided?: string; tweaked?: boolean; auto_approved?: boolean; }

/** From the history of past runs' decisions, compute how much the human has been agreeing with the AI's
 *  render picks. Only human decisions count (auto-approved runs are excluded so autonomy can't bootstrap its
 *  own trust). agreementRate = clean approvals (approved with NO tweak) ÷ all human decisions. Pure. */
export function computeAgreement(decisions: Decision[]): { approvedRuns: number; cleanApprovals: number; humanDecisions: number; agreementRate: number } {
  const human = (decisions || []).filter((d) => d.auto_approved !== true && (d.decided === "approved" || d.decided === "rejected"));
  const approvedRuns = human.filter((d) => d.decided === "approved").length;
  const cleanApprovals = human.filter((d) => d.decided === "approved" && !d.tweaked).length;
  const humanDecisions = human.length;
  const agreementRate = humanDecisions ? cleanApprovals / humanDecisions : 0;
  return { approvedRuns, cleanApprovals, humanDecisions, agreementRate };
}

export interface TrustSignals { approvedRuns: number; agreementRate: number; playbookSample: number; }
export interface TrustThresholds { minRuns: number; minAgreement: number; minPlaybook: number; }

/** Decide whether this run's render can auto-approve (skip the human gate). "full" always; "manual" never;
 *  "earned" only when ALL trust bars are cleared. Returns the reason + per-bar progress for the UI. Pure. */
export function autonomyDecision(autonomy: Autonomy, t: TrustSignals, thr: TrustThresholds): {
  auto_approve: boolean; earned: boolean; reason: string;
  progress: { runs: [number, number]; agreement: [number, number]; playbook: [number, number] };
} {
  const progress = {
    runs: [t.approvedRuns, thr.minRuns] as [number, number],
    agreement: [Math.round(t.agreementRate * 100) / 100, thr.minAgreement] as [number, number],
    playbook: [t.playbookSample, thr.minPlaybook] as [number, number],
  };
  const okRuns = t.approvedRuns >= thr.minRuns;
  const okAgree = t.agreementRate >= thr.minAgreement;
  const okPlay = t.playbookSample >= thr.minPlaybook;
  const earned = okRuns && okAgree && okPlay;
  if (autonomy === "full") return { auto_approve: true, earned, reason: "full autonomy (owner-delegated)", progress };
  if (autonomy === "manual") return { auto_approve: false, earned, reason: "manual approval required", progress };
  // earned mode
  if (earned) return { auto_approve: true, earned, reason: "trust earned — auto-approving within budget", progress };
  const need: string[] = [];
  if (!okRuns) need.push(`${t.approvedRuns}/${thr.minRuns} approved runs`);
  if (!okAgree) need.push(`${Math.round(t.agreementRate * 100)}%/${Math.round(thr.minAgreement * 100)}% agreement`);
  if (!okPlay) need.push(`${t.playbookSample}/${thr.minPlaybook} learning outcomes`);
  return { auto_approve: false, earned, reason: `earning trust — still need: ${need.join(", ")}`, progress };
}

// ── gate logic ──────────────────────────────────────────────────────────────────────────────────────────
export interface PollReadyInput { votes: number; minVotes: number; ageHours: number; maxHours: number; }

/** A collecting run is ready to advance to the approval gate when it has enough votes, OR it has waited long
 *  enough (so a low-traffic poll never hangs the pipeline — it proceeds on predictive scores). Pure. */
export function pollReady(i: PollReadyInput): { ready: boolean; reason: string } {
  if (i.minVotes <= 0) return { ready: true, reason: "no vote minimum set" };
  if (i.votes >= i.minVotes) return { ready: true, reason: `reached ${i.votes} votes` };
  if (i.maxHours > 0 && i.ageHours >= i.maxHours) return { ready: true, reason: `waited ${Math.floor(i.ageHours)}h (max ${i.maxHours}h) — proceeding on predictive scores` };
  return { ready: false, reason: `have ${i.votes}/${i.minVotes} votes, ${Math.floor(i.ageHours)}h elapsed` };
}

/** Apply a human "tweak": keep only the candidate ids the approver kept (order preserved). If no explicit
 *  subset is given, all candidates are approved. Ids not in the candidate set are ignored. Pure. */
export function tweakSelection(candidateIds: string[], approvedIds?: string[] | null): string[] {
  const candidates = (candidateIds || []).filter(Boolean);
  if (!approvedIds || !approvedIds.length) return candidates;
  const keep = new Set(approvedIds);
  return candidates.filter((id) => keep.has(id));
}

/** Hours between an ISO timestamp and now. Pure given `nowMs`. */
export function ageHours(startedISO: string, nowMs: number): number {
  const t = Date.parse(startedISO || "");
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / 3600000);
}

export interface RunLike { stage?: string; poll_id?: string; concept_count?: number; votes?: number; est_cost_usd?: number; candidates?: unknown[]; started_at?: string; }

/** A compact, UI-friendly summary of a run's state. Pure. */
export function runSummary(run: RunLike): { stage: string; needs_approval: boolean; terminal: boolean; candidates: number; est_cost_usd: number } {
  const stage = String(run?.stage ?? "error");
  return {
    stage,
    needs_approval: needsApproval(stage),
    terminal: isTerminal(stage),
    candidates: Array.isArray(run?.candidates) ? run!.candidates!.length : 0,
    est_cost_usd: Number(run?.est_cost_usd) || 0,
  };
}
