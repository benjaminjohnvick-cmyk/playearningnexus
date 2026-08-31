import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { assessHealth, type HealthSnapshot } from "../../sdk/maintenance.ts";
import { canAutoApply } from "../../sdk/agent-guardrails.ts";

// maintenanceAgentRun — the site-maintenance AI. Sibling of the scaling advisor: same advisory, human-gated,
// server-authoritative guardrails (agent-guardrails.ts), different job. On a schedule it gathers real health
// signals, runs the pure assessHealth() decision core, writes a MaintenanceReport, and (optionally) explains it
// in plain English via the platform LLM. It DETECTS and PROPOSES; it does not fix money/identity/secrets/security
// or code, and it applies nothing on its own unless a proposal is auto-safe AND the operator turned auto-apply on
// (and even then, only through the guarded maintenanceApplyProposal path). Gated OFF behind MAINTENANCE_AGENT_ENABLED.
// Admin only.
//
// Signals are gathered best-effort and every query is guarded — a maintenance agent must never itself become a
// source of errors. An external monitor may POST precise numbers in `body.snapshot`, which override the proxies.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = snapBool("MAINTENANCE_AGENT_ENABLED", false);
    const autoApply = snapBool("MAINTENANCE_AUTO_APPLY_SAFE", false);

    // ── thresholds (operator-tunable) ──
    const errorSpikeThreshold = Math.max(1, snapNumber("MAINTENANCE_ERROR_SPIKE_PER_HR", 100));
    const stalePendingHours = Math.max(1, snapNumber("MAINTENANCE_STALE_PENDING_HOURS", 48));
    const stuckJobHours = Math.max(1, snapNumber("MAINTENANCE_STUCK_JOB_HOURS", 1));
    const storageWarnPct = Math.max(1, snapNumber("MAINTENANCE_STORAGE_WARN_PCT", 85));
    const secretWarnDays = Math.max(1, snapNumber("MAINTENANCE_SECRET_EXPIRY_WARN_DAYS", 14));

    // ── gather signals (best-effort, all guarded) ──
    const now = Date.now();
    const hourAgo = new Date(now - 3600_000).toISOString();
    const stuckCut = new Date(now - stuckJobHours * 3600_000).toISOString();
    const staleCut = new Date(now - stalePendingHours * 3600_000).toISOString();
    const ov = body?.snapshot ?? {};

    const errorsLastHour = num(ov.errorsLastHour, await db.count("AIActivityLog", { level: "error", created_date: { $gte: hourAgo } }).catch(() => 0));
    const stuckJobs = num(ov.stuckJobs, await db.count("VideoPipelineRun", { status: "running", created_date: { $lte: stuckCut } }).catch(() => 0));
    const failedJobs = num(ov.failedJobs, await db.count("VideoPipelineRun", { status: "failed", created_date: { $gte: new Date(now - 24 * 3600_000).toISOString() } }).catch(() => 0));
    const stalePending = num(ov.stalePending, await db.count("AdvertiserApplication", { status: "pending", created_date: { $lte: staleCut } }).catch(() => 0));

    const snapshot: HealthSnapshot = {
      errorsLastHour, errorSpikeThreshold,
      stuckJobs, failedJobs,
      stalePending, stalePendingHours,
      // schedulerMissed / storagePct / secrets are hard to infer reliably from app data — they come from a
      // monitor via body.snapshot when available, else empty/unknown (0) so we never raise a false alarm.
      schedulerMissed: Array.isArray(ov.schedulerMissed) ? ov.schedulerMissed.map(String) : [],
      storagePct: num(ov.storagePct, 0), storageWarnPct,
      secretsExpiringDays: Array.isArray(ov.secretsExpiringDays) ? ov.secretsExpiringDays : [],
      secretWarnDays,
    };

    const assessment = assessHealth(snapshot);

    // Which findings COULD be auto-applied right now (auto_safe + operator opted in)? We only mark them; the
    // actual apply goes through maintenanceApplyProposal so there is one audited execution path.
    const autoApplicable = assessment.findings.filter((f) => canAutoApply(f, autoApply)).map((f) => f.id);

    // Persist a report (skip on dry runs). MaintenanceReport is a plain log entity.
    let reportId: string | null = null;
    if (enabled && body.dry_run !== true) {
      const rec = await db.create("MaintenanceReport", {
        status: assessment.status,
        summary: assessment.summary,
        counts: assessment.counts,
        findings: assessment.findings,
        auto_applicable: autoApplicable,
        auto_apply_enabled: autoApply,
        snapshot,
        generated_by: user.email ?? user.id,
        at: new Date().toISOString(),
      }, user.email ?? String(user.id)).catch(() => null);
      reportId = rec ? String((rec as Record<string, unknown>).id ?? "") : null;
    }

    // Optional plain-English diagnosis (same pattern as the scaling advisor). The LLM explains; it never decides
    // an action — the action classes are already fixed by the deterministic core + guardrails.
    let diagnosis = "";
    if (enabled && body.explain !== false && assessment.findings.length > 0) {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are the platform's site-maintenance agent. In 2-3 plain-English sentences, summarize the site's health and what the operator should do next. Do NOT propose code changes, and do not suggest touching money, identity, secrets, or security — those are flagged for a human already.
STATUS: ${assessment.status}
FINDINGS: ${JSON.stringify(assessment.findings.map((f) => ({ title: f.title, severity: f.severity, action: f.actionClass })))}`,
      }).catch(() => null) as Record<string, unknown> | null;
      diagnosis = String(r?.content ?? r ?? "").toString().slice(0, 1000);
    }

    return Response.json({
      ok: true,
      enabled,
      auto_apply_enabled: autoApply,
      status: assessment.status,
      summary: assessment.summary,
      counts: assessment.counts,
      findings: assessment.findings,
      auto_applicable: autoApplicable,
      report_id: reportId,
      diagnosis,
      note: !enabled
        ? "Maintenance agent OFF — this is a preview only; nothing was recorded or applied. Enable MAINTENANCE_AGENT_ENABLED to run it on schedule."
        : autoApplicable.length
          ? `Recorded. ${autoApplicable.length} finding(s) are auto-safe and auto-apply is on — apply them via maintenanceApplyProposal. Everything else waits for a human.`
          : "Recorded. Nothing is being applied automatically — review the findings and apply approved ones via maintenanceApplyProposal.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

function num(override: unknown, fallback: number): number {
  const o = Number(override);
  return Number.isFinite(o) && o >= 0 ? o : (Number(fallback) || 0);
}
