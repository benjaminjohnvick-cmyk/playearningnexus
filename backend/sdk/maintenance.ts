// maintenance.ts — the pure decision core of the site-maintenance agent. Given a HealthSnapshot (plain numbers
// the agent function gathered from the DB / a monitor), it produces a prioritized list of findings, each already
// tagged with a severity and an action-class from the shared guardrails. It never does I/O and never decides on
// its own to apply anything — it only describes what's wrong and what the SAFE remedy would be. The agent
// function then reports these, and (only for the auto_safe class, only if the operator allows) may apply them
// through the guarded apply path.
//
// The split matters: this file is where "what counts as unhealthy" lives (thresholds, staleness windows), fully
// unit-testable; agent-guardrails.ts is where "what an agent is allowed to do about it" lives. Neither can touch
// money, identity, secrets, security, or code — those findings come out as manual_only, i.e. flag-for-a-human.

import type { AgentProposal, Severity } from "./agent-guardrails.ts";
import { prioritize, overallStatus, classifyProposal } from "./agent-guardrails.ts";

export interface HealthSnapshot {
  errorsLastHour: number;        // app errors logged in the last hour
  errorSpikeThreshold: number;   // at/above this many errors/hr = a spike worth flagging
  stuckJobs: number;             // non-money background jobs stuck "running" past the max runtime
  failedJobs: number;            // non-money jobs that ended "failed" (dead-letter) recently
  stalePending: number;          // non-money records stuck "pending" past the staleness window
  stalePendingHours: number;     // how old "stale" means (for the message)
  schedulerMissed: string[];     // names of scheduled jobs that should have run recently but didn't
  storagePct: number;            // storage/quota used, 0..100 (0 = unknown/not reported)
  storageWarnPct: number;        // warn at/above this %
  secretsExpiringDays: Array<{ name: string; days: number }>; // secrets/certs and days until expiry
  secretWarnDays: number;        // warn when a secret expires within this many days
}

export interface MaintenanceAssessment {
  status: "healthy" | "attention" | "critical";
  findings: AgentProposal[];
  counts: { critical: number; warn: number; info: number };
  summary: string;
}

const sev = (s: Severity) => s;

/** Deterministically assess a health snapshot into prioritized, guard-classified findings. Pure. */
export function assessHealth(s: HealthSnapshot): MaintenanceAssessment {
  const raw: AgentProposal[] = [];

  // 1) Stuck jobs — reversible: put them back on the queue. Auto-safe (non-money only; the entity allowlist in
  //    guardrails enforces that a money job could never be one of these).
  if (s.stuckJobs > 0) {
    raw.push({
      id: "stuck_jobs",
      title: `${s.stuckJobs} background job(s) stuck running`,
      detail: `${s.stuckJobs} non-money job(s) have been "running" past their max runtime. Re-queuing them clears the stall; it's reversible and idempotent.`,
      severity: sev(s.stuckJobs >= 25 ? "critical" : "warn"),
      actionClass: "auto_safe",
      suggestedAction: "requeue_job",
      target: { entity: "VideoPipelineRun" },
      evidence: `stuckJobs=${s.stuckJobs}`,
    });
  }

  // 2) Failed / dead-letter jobs — same remedy class.
  if (s.failedJobs > 0) {
    raw.push({
      id: "failed_jobs",
      title: `${s.failedJobs} failed background job(s)`,
      detail: `${s.failedJobs} non-money job(s) ended in "failed". Re-queuing retries them; persistent failures should then be read by a human.`,
      severity: sev(s.failedJobs >= 25 ? "critical" : "warn"),
      actionClass: "auto_safe",
      suggestedAction: "requeue_job",
      target: { entity: "VideoPipelineRun" },
      evidence: `failedJobs=${s.failedJobs}`,
    });
  }

  // 3) Missed scheduled jobs — re-run them. Auto-safe.
  if (s.schedulerMissed.length > 0) {
    raw.push({
      id: "scheduler_missed",
      title: `${s.schedulerMissed.length} scheduled job(s) did not run`,
      detail: `These jobs were expected to run and didn't: ${s.schedulerMissed.join(", ")}. Re-running catches the platform up.`,
      severity: sev(s.schedulerMissed.length >= 3 ? "critical" : "warn"),
      actionClass: "auto_safe",
      suggestedAction: "rerun_scheduler",
      evidence: s.schedulerMissed.join(","),
    });
  }

  // 4) Stale pending records — recoverable data change, but never unattended: soft-archive needs a human.
  if (s.stalePending > 0) {
    raw.push({
      id: "stale_pending",
      title: `${s.stalePending} record(s) stuck pending > ${s.stalePendingHours}h`,
      detail: `${s.stalePending} non-money record(s) have sat "pending" beyond ${s.stalePendingHours}h. The safe remedy is a SOFT archive (mark archived, never hard delete) after a human confirms.`,
      severity: sev("warn"),
      actionClass: "needs_approval",
      suggestedAction: "soft_archive",
      target: { entity: "AdvertiserApplication" },
      evidence: `stalePending=${s.stalePending}`,
    });
  }

  // 5) Error-rate spike — the agent CANNOT fix code, so it only flags for a human. manual_only.
  if (s.errorsLastHour >= s.errorSpikeThreshold && s.errorSpikeThreshold > 0) {
    raw.push({
      id: "error_spike",
      title: `Error spike: ${s.errorsLastHour} errors in the last hour`,
      detail: `Errors/hr (${s.errorsLastHour}) crossed the spike threshold (${s.errorSpikeThreshold}). This needs a human to read the logs — the agent does not change code.`,
      severity: sev(s.errorsLastHour >= s.errorSpikeThreshold * 3 ? "critical" : "warn"),
      actionClass: "manual_only",
      suggestedAction: "investigate",
      evidence: `errorsLastHour=${s.errorsLastHour} threshold=${s.errorSpikeThreshold}`,
    });
  }

  // 6) Storage high — cleanup of old logs/caches is recoverable but not unattended.
  if (s.storagePct > 0 && s.storagePct >= s.storageWarnPct) {
    raw.push({
      id: "storage_high",
      title: `Storage ${s.storagePct}% used`,
      detail: `Storage is at ${s.storagePct}% (warn ${s.storageWarnPct}%). A human should approve trimming old logs/caches (TTL/soft cleanup) or expanding capacity.`,
      severity: sev(s.storagePct >= 95 ? "critical" : "warn"),
      actionClass: "needs_approval",
      suggestedAction: "trim_old_logs",
      target: { entity: "AIActivityLog" },
      evidence: `storagePct=${s.storagePct}`,
    });
  }

  // 7) Secrets/certs expiring — the agent NEVER touches secrets; flag for a human to rotate. manual_only.
  for (const sec of s.secretsExpiringDays) {
    if (sec.days <= s.secretWarnDays) {
      raw.push({
        id: `secret_expiry_${sec.name}`,
        title: `Secret/cert "${sec.name}" expires in ${sec.days} day(s)`,
        detail: `"${sec.name}" expires in ${sec.days} day(s). Rotating credentials is a human action — the agent only reminds.`,
        severity: sev(sec.days <= 3 ? "critical" : "warn"),
        actionClass: "manual_only",
        suggestedAction: "rotate_secret",
        evidence: `${sec.name}:${sec.days}d`,
      });
    }
  }

  // Clamp every finding through the shared guardrails (defense in depth), then prioritize.
  const findings = prioritize(raw.map(classifyProposal));
  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    warn: findings.filter((f) => f.severity === "warn").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
  const status = overallStatus(findings);
  const summary = findings.length === 0
    ? "All monitored maintenance signals are healthy."
    : `${findings.length} finding(s): ${counts.critical} critical, ${counts.warn} warn. ` +
      `${findings.filter((f) => f.actionClass === "auto_safe").length} auto-safe, ` +
      `${findings.filter((f) => f.actionClass === "needs_approval").length} need approval, ` +
      `${findings.filter((f) => f.actionClass === "manual_only").length} for a human only.`;

  return { status, findings, counts, summary };
}
