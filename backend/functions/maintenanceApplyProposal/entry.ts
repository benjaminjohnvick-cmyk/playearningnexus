import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { guardApply, classifyProposal, APPLY_ENTITY_ALLOWLIST, type AgentProposal } from "../../sdk/agent-guardrails.ts";

// maintenanceApplyProposal — the ONE audited path that actually executes a maintenance proposal. Everything the
// maintenance agent might "fix" flows through here, so there is a single choke point for the guardrails. It:
//   • re-classifies the proposal through the shared guardrails (never trusts the caller's action-class),
//   • runs guardApply() with the operator's auto-apply setting and whether a human confirmed THIS apply,
//   • performs only SAFE, reversible DB state transitions on allowlisted, non-money entities,
//   • records an AdminAuditLog entry either way.
// manual_only proposals (money/identity/secrets/security/code/hard-delete) are refused here, categorically — the
// agent flags them; a human does them elsewhere. Nothing in this file deletes a row (db.remove is never called);
// "archive" is a soft flag. Admin only; gated behind MAINTENANCE_AGENT_ENABLED.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!snapBool("MAINTENANCE_AGENT_ENABLED", false)) {
      return Response.json({ error: "Maintenance agent is disabled (MAINTENANCE_AGENT_ENABLED off)." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const proposalIn = body?.proposal as AgentProposal | undefined;
    if (!proposalIn || !proposalIn.suggestedAction) {
      return Response.json({ error: "Provide `proposal` (from a MaintenanceReport finding)." }, { status: 400 });
    }
    const proposal = classifyProposal(proposalIn);
    const humanConfirmed = body.confirm === true || body.confirm === "MAINTENANCE_APPROVED";
    const autoApply = snapBool("MAINTENANCE_AUTO_APPLY_SAFE", false);

    const gate = guardApply(proposal, { autoApplyEnabled: autoApply, humanConfirmed });
    if (!gate.allowed) {
      await audit(user, proposal, "refused", gate.reason);
      return Response.json({ ok: false, applied: false, reason: gate.reason, action_class: proposal.actionClass }, { status: 403 });
    }

    // Execute the specific safe action.
    const ent = proposal.target?.entity;
    const id = proposal.target?.id;
    let applied = false;
    let detail = "";

    switch (proposal.suggestedAction) {
      case "requeue_job": {
        // Put a stuck/failed non-money job back on the queue. Reversible; touches only status.
        if (!allowEntity(ent)) { detail = "entity not allowlisted"; break; }
        if (id) {
          const r = await db.update(ent!, id, { status: "queued", requeued_by: "maintenance_agent", requeued_at: new Date().toISOString() }).catch(() => null);
          applied = !!r; detail = applied ? `Re-queued ${ent}#${id}` : "row not found";
        } else {
          // Bulk: re-queue the stuck ones (bounded).
          const rows = await db.filter(ent!, { status: "running" }, "created_date", 100).catch(() => []) as Record<string, unknown>[];
          let n = 0;
          for (const row of rows) { const rr = await db.update(ent!, String(row.id), { status: "queued", requeued_by: "maintenance_agent" }).catch(() => null); if (rr) n++; }
          applied = n > 0; detail = `Re-queued ${n} ${ent} job(s)`;
        }
        break;
      }
      case "rerun_scheduler": {
        // We do NOT invoke arbitrary functions from here (that would be an open exec path). Instead we record an
        // approved re-run request the scheduler/operator picks up. Safe + auditable.
        await db.create("MaintenanceReport", { kind: "rerun_request", jobs: String(proposal.evidence || ""), approved_by: user.email ?? user.id, at: new Date().toISOString() }).catch(() => null);
        applied = true; detail = `Logged approved re-run request for: ${proposal.evidence || "(unspecified)"}`;
        break;
      }
      case "soft_archive": {
        if (!allowEntity(ent)) { detail = "entity not allowlisted"; break; }
        if (id) {
          const r = await db.update(ent!, id, { archived: true, archived_by: "maintenance_agent", archived_at: new Date().toISOString() }).catch(() => null);
          applied = !!r; detail = applied ? `Soft-archived ${ent}#${id} (not deleted)` : "row not found";
        } else {
          detail = "soft_archive requires a specific target id — refusing a blind bulk archive";
        }
        break;
      }
      case "trim_old_logs": {
        // Soft trim: mark old log rows archived so a retention job can drop them later. Never a hard delete here.
        if (!allowEntity(ent)) { detail = "entity not allowlisted"; break; }
        const cutoff = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
        const rows = await db.filter(ent!, { created_date: { $lte: cutoff } }, "created_date", 500).catch(() => []) as Record<string, unknown>[];
        let n = 0;
        for (const row of rows) { const rr = await db.update(ent!, String(row.id), { archived: true, archived_by: "maintenance_agent" }).catch(() => null); if (rr) n++; }
        applied = n > 0; detail = `Marked ${n} old ${ent} row(s) archived (soft; a retention job removes them).`;
        break;
      }
      default:
        detail = `No executor for action "${proposal.suggestedAction}" — treated as manual.`;
    }

    await audit(user, proposal, applied ? "applied" : "noop", detail);
    return Response.json({ ok: true, applied, action: proposal.suggestedAction, action_class: proposal.actionClass, detail, reason: gate.reason });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

function allowEntity(ent?: string): boolean {
  return !!ent && APPLY_ENTITY_ALLOWLIST.has(ent);
}

async function audit(user: Record<string, unknown>, proposal: AgentProposal, outcome: string, detail: string) {
  await db.create("AdminAuditLog", {
    action: "maintenance_apply",
    outcome,
    proposal_id: proposal.id,
    suggested_action: proposal.suggestedAction,
    action_class: proposal.actionClass,
    target: proposal.target ?? null,
    detail,
    actor: user.email ?? user.id,
    at: new Date().toISOString(),
  }).catch(() => null);
}
