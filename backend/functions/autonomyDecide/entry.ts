import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  domainById, resolvePolicy, computeAgreement, autonomyDecision, currentThresholds, autonomyKillSwitch,
} from "../../sdk/autonomy-kernel.ts";

// autonomyDecide — the reusable GATE any automated process calls before acting. Give it a domain + a proposal;
// it computes that domain's trust, asks the kernel, records an AutonomyDecision, and tells the caller whether
// it may act now (auto_approve) or must wait for a human. This is the single plumbing point that makes every
// process graduate on the same rules. Admin / seed-admin service (the automations run as the service user).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const domainId = String(body.domain ?? "");
    if (!domainById(domainId)) return Response.json({ error: "Unknown domain." }, { status: 400 });

    const now = new Date().toISOString();
    const [override, decisions, fbCount] = await Promise.all([
      db.filter("AutonomyDomain", { domain_id: domainId }, "-created_at", 1).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("AutonomyDecision", { domain: domainId }, "-created_at", 2000).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.count("FeedbackEvent", { domain: domainId }).catch(() => 0),
    ]);
    const policy = resolvePolicy(domainId, override?.[0]?.mode as string | undefined);
    const agree = computeAgreement((decisions || []).map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
    const dataSample = (Number(fbCount) || 0) + (decisions?.length || 0);
    const decision = autonomyDecision(policy, { approvedRuns: agree.approvedRuns, agreementRate: agree.agreementRate, dataSample }, currentThresholds(), autonomyKillSwitch());

    const row = await db.create("AutonomyDecision", {
      domain: domainId, subject_id: body.subject_id ? String(body.subject_id).slice(0, 120) : null,
      proposal: body.proposal ?? null, caps: body.caps ?? null,
      stage: decision.auto_approve ? "approved" : "awaiting_approval",
      auto_approved: decision.auto_approve, decided: decision.auto_approve ? "approved" : null, tweaked: false,
      mode: policy.mode, reason: decision.reason, permanent_gate: policy.permanent_gate,
      created_at: now, updated_at: now,
    }).catch(() => null) as Record<string, unknown> | null;

    return Response.json({
      ok: true, decision_id: row?.id ?? null, domain: domainId,
      auto_approve: decision.auto_approve, stage: decision.auto_approve ? "approved" : "awaiting_approval",
      reason: decision.reason, mode: policy.mode, permanent_gate: policy.permanent_gate,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
