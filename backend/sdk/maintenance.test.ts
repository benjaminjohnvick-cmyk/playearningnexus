import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assessHealth, type HealthSnapshot } from "./maintenance.ts";
import { classifyProposal, guardApply, canAutoApply, type AgentProposal } from "./agent-guardrails.ts";

const healthy: HealthSnapshot = {
  errorsLastHour: 2, errorSpikeThreshold: 100,
  stuckJobs: 0, failedJobs: 0,
  stalePending: 0, stalePendingHours: 48,
  schedulerMissed: [], storagePct: 40, storageWarnPct: 85,
  secretsExpiringDays: [{ name: "STRIPE_KEY", days: 200 }], secretWarnDays: 14,
};

Deno.test("assessHealth: clean snapshot = healthy, no findings", () => {
  const a = assessHealth(healthy);
  assertEquals(a.status, "healthy");
  assertEquals(a.findings.length, 0);
});

Deno.test("assessHealth: mixed problems produce the right classes and ordering", () => {
  const a = assessHealth({
    ...healthy,
    stuckJobs: 3,                 // auto_safe
    stalePending: 10,             // needs_approval
    errorsLastHour: 400,          // manual_only, critical (>3x threshold)
    secretsExpiringDays: [{ name: "TLS_CERT", days: 2 }], // manual_only, critical
  });
  assert(a.findings.length >= 4);
  assertEquals(a.status, "critical");
  // critical findings sort first
  assertEquals(a.findings[0].severity, "critical");
  const byId = Object.fromEntries(a.findings.map((f) => [f.id, f]));
  assertEquals(byId["stuck_jobs"].actionClass, "auto_safe");
  assertEquals(byId["stale_pending"].actionClass, "needs_approval");
  assertEquals(byId["error_spike"].actionClass, "manual_only");
  assert(byId["secret_expiry_TLS_CERT"].actionClass === "manual_only");
});

Deno.test("guardrails: manual_only is never applicable, even if a caller mislabels it", () => {
  // A proposal that TOUCHES money but is (wrongly) tagged auto_safe must be clamped to manual_only.
  const sneaky: AgentProposal = {
    id: "x", title: "re-run payout batch", detail: "", severity: "warn",
    actionClass: "auto_safe", suggestedAction: "requeue_job", target: { entity: "PayoutBatch" },
  };
  assertEquals(classifyProposal(sneaky).actionClass, "manual_only");
  assertEquals(canAutoApply(sneaky, true), false);
  assertEquals(guardApply(sneaky, { autoApplyEnabled: true, humanConfirmed: true }).allowed, false);
});

Deno.test("guardrails: auto_safe needs auto-apply OR a human; needs_approval needs a human", () => {
  const autoSafe: AgentProposal = { id: "a", title: "requeue render", detail: "", severity: "warn", actionClass: "auto_safe", suggestedAction: "requeue_job", target: { entity: "VideoPipelineRun" } };
  assertEquals(guardApply(autoSafe, { autoApplyEnabled: false, humanConfirmed: false }).allowed, false);
  assertEquals(guardApply(autoSafe, { autoApplyEnabled: true, humanConfirmed: false }).allowed, true);
  assertEquals(guardApply(autoSafe, { autoApplyEnabled: false, humanConfirmed: true }).allowed, true);

  const approve: AgentProposal = { id: "b", title: "archive stale app", detail: "", severity: "warn", actionClass: "needs_approval", suggestedAction: "soft_archive", target: { entity: "AdvertiserApplication" } };
  assertEquals(guardApply(approve, { autoApplyEnabled: true, humanConfirmed: false }).allowed, false); // auto-apply must NOT satisfy needs_approval
  assertEquals(guardApply(approve, { autoApplyEnabled: false, humanConfirmed: true }).allowed, true);
});

Deno.test("guardrails: a write to a non-allowlisted entity is clamped to manual_only", () => {
  const p: AgentProposal = { id: "c", title: "requeue", detail: "", severity: "info", actionClass: "auto_safe", suggestedAction: "requeue_job", target: { entity: "SomeRandomEntity" } };
  assertEquals(classifyProposal(p).actionClass, "manual_only");
});
