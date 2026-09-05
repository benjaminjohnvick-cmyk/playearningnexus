import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  DOMAINS, resolvePolicy, computeAgreement, autonomyDecision, currentThresholds,
  autonomyEnabled, autonomyKillSwitch, autonomyAutoOkDefault,
} from "../../sdk/autonomy-kernel.ts";

// autonomyStatus — the Automation Command Center payload: every domain, its class (can-graduate vs permanent
// human gate), its live autonomy mode, its TRUST meter (how close to auto), and how many decisions are waiting
// for a human. One read of the shared decision + feedback history, grouped in memory. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const thr = currentThresholds();
    const kill = autonomyKillSwitch();
    const autoOkDefault = autonomyAutoOkDefault();

    const [overridesRows, decisions, feedback] = await Promise.all([
      db.filter("AutonomyDomain", {}, "-created_at", 200).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("AutonomyDecision", {}, "-created_at", 8000).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("FeedbackEvent", {}, "-created_at", 8000).catch(() => []) as Promise<Record<string, unknown>[]>,
    ]);

    // Latest override per domain.
    const overrides: Record<string, string> = {};
    for (const o of overridesRows) { const id = String(o.domain_id ?? ""); if (id && !(id in overrides)) overrides[id] = String(o.mode ?? ""); }

    // Group decisions + feedback by domain.
    const decByDomain: Record<string, Record<string, unknown>[]> = {};
    for (const d of decisions) { const id = String(d.domain ?? ""); (decByDomain[id] ??= []).push(d); }
    const fbCount: Record<string, number> = {};
    for (const f of feedback) { const id = String(f.domain ?? ""); if (id) fbCount[id] = (fbCount[id] || 0) + 1; }

    const domains = DOMAINS.map((dom) => {
      const policy = resolvePolicy(dom.id, overrides[dom.id], autoOkDefault);
      const dRows = decByDomain[dom.id] || [];
      const agree = computeAgreement(dRows.map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
      const dataSample = (fbCount[dom.id] || 0) + dRows.length;
      const decision = autonomyDecision(policy, { approvedRuns: agree.approvedRuns, agreementRate: agree.agreementRate, dataSample }, thr, kill);
      const pending = dRows.filter((r) => String(r.stage) === "awaiting_approval").length;
      return {
        id: dom.id, label: dom.label, group: dom.group, klass: dom.klass, note: dom.note ?? null,
        mode: policy.mode, permanent_gate: policy.permanent_gate,
        auto_approving: decision.auto_approve, earned: decision.earned, status: decision.reason, progress: decision.progress,
        trust: { approved: agree.approvedRuns, agreement: Math.round(agree.agreementRate * 100) / 100, data: dataSample, decisions: agree.humanDecisions },
        pending_approvals: pending,
      };
    });

    return Response.json({
      enabled: autonomyEnabled(),
      kill_switch: kill,
      thresholds: thr,
      totals: {
        domains: domains.length,
        auto_ok: domains.filter((d) => d.klass === "auto_ok").length,
        permanent_gate: domains.filter((d) => d.klass === "permanent_gate").length,
        auto_approving: domains.filter((d) => d.auto_approving).length,
        pending_approvals: domains.reduce((s, d) => s + d.pending_approvals, 0),
      },
      domains,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
