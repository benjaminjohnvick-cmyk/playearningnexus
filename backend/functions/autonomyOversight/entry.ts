import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import {
  DOMAINS, resolvePolicy, computeAgreement, autonomyAutoOkDefault,
  autonomyEnabled, autonomyKillSwitch, trustMinAgreement,
} from "../../sdk/autonomy-kernel.ts";
import { aiPaused } from "../../sdk/ai-control.ts";
import { autoApplyMode } from "../../sdk/ai-autonomy.ts";
import { aiDailySpendUsd } from "../../sdk/integrations.ts";
import { snapNumber, primeSettings } from "../../sdk/settings.ts";

// autonomyOversight (admin) — the EXCEPTION-BASED oversight dashboard for the autonomy platform. Instead of
// asking a human to approve everything, it surfaces only what needs attention: the global brakes, actions that
// FAILED or are stale in the queue, domains that aren't earning trust, and spend near the cap — ranked by
// severity — plus a compact per-domain trust snapshot. This is the interface an autonomous business runs on:
// watch the exceptions, tap the gates. Read-only. Not legal advice.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    await primeSettings().catch(() => {});
    const staleHours = Math.max(1, snapNumber("AUTONOMY_PENDING_STALE_HOURS", 24));
    const staleCutMs = Date.now() - staleHours * 3600 * 1000;
    const minAgree = trustMinAgreement();
    const spendCap = snapNumber("AI_DAILY_SPEND_CAP_USD", 0);
    const spendUsd = aiDailySpendUsd();

    // One bounded pull of recent decisions + the pending inbox + global brake reads.
    const [recent, pendingRows, paused] = await Promise.all([
      db.filter("AutonomyDecision", {}, "-created_at", 1000).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("AutomationReview", { type: "agent_action", status: "pending_approval" }, "-created_date", 300).catch(() => []) as Promise<Record<string, unknown>[]>,
      aiPaused().catch(() => false),
    ]);

    // Group decisions by domain (in-memory — one query, not one-per-domain).
    const byDomain = new Map<string, Record<string, unknown>[]>();
    for (const r of recent || []) {
      const d = String(r.domain ?? "");
      if (!d) continue;
      (byDomain.get(d) ?? byDomain.set(d, []).get(d)!).push(r);
    }

    const autoDefault = autonomyAutoOkDefault();
    const exceptions: Array<{ severity: number; type: string; domain?: string; label?: string; detail: string; count?: number }> = [];
    const domainCards: Record<string, unknown>[] = [];
    let autoDomains = 0, earningDomains = 0;
    // Coverage toward "the whole reversible loop is routed through the kernel": an auto_ok domain counts as
    // WIRED once it has at least one gated decision on record (i.e. a real action flows through gateAndRun).
    let autoOkTotal = 0, autoOkWired = 0;

    // Global brakes → top-level exceptions.
    if (!autonomyEnabled()) exceptions.push({ severity: 5, type: "autonomy_off", detail: "Autonomy platform is OFF — nothing runs automatically." });
    if (autonomyKillSwitch()) exceptions.push({ severity: 5, type: "kill_switch", detail: "Global kill switch is ON — every action waits for a human." });
    if (paused) exceptions.push({ severity: 4, type: "ai_paused", detail: "AI is paused by a human — automatic actions are held." });
    if (spendCap > 0 && spendUsd >= spendCap * 0.9) {
      exceptions.push({ severity: spendUsd >= spendCap ? 5 : 3, type: "spend_near_cap", detail: `AI spend $${spendUsd.toFixed(2)} of $${spendCap.toFixed(2)} daily cap (${Math.round((spendUsd / spendCap) * 100)}%).` });
    }

    for (const dom of DOMAINS) {
      const rows = byDomain.get(dom.id) ?? [];
      const policy = resolvePolicy(dom.id, undefined, autoDefault); // note: per-domain override not re-read here (see autonomyStatus for exact mode)
      const agree = computeAgreement(rows.map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
      const applied = rows.filter((r) => r.stage === "applied").length;
      const failed = rows.filter((r) => r.stage === "failed").length;
      const awaiting = rows.filter((r) => r.stage === "awaiting_approval");
      const stale = awaiting.filter((r) => { const t = Date.parse(String(r.created_at ?? r.created_date ?? "")); return Number.isFinite(t) && t < staleCutMs; }).length;

      if (!policy.permanent_gate && policy.mode === "full") autoDomains++;
      if (!policy.permanent_gate && policy.mode === "earned") earningDomains++;
      const wired = rows.length > 0;
      if (dom.klass === "auto_ok") { autoOkTotal++; if (wired) autoOkWired++; }

      // Per-domain exceptions.
      if (failed > 0) exceptions.push({ severity: 4, type: "failed_action", domain: dom.id, label: dom.label, count: failed, detail: `${failed} auto-action(s) FAILED in ${dom.label} — review and retry or fix.` });
      if (stale > 0) exceptions.push({ severity: 3, type: "stale_pending", domain: dom.id, label: dom.label, count: stale, detail: `${stale} item(s) waiting > ${staleHours}h for human approval in ${dom.label}.` });
      if (!policy.permanent_gate && policy.mode === "earned" && agree.humanDecisions >= 5 && agree.agreementRate < minAgree) {
        exceptions.push({ severity: 2, type: "not_earning_trust", domain: dom.id, label: dom.label, detail: `${dom.label} agreement ${Math.round(agree.agreementRate * 100)}% is below the ${Math.round(minAgree * 100)}% bar — it won't graduate until your approvals get cleaner.` });
      }
      if (policy.permanent_gate && awaiting.length > 0) {
        exceptions.push({ severity: 2, type: "gate_awaiting_human", domain: dom.id, label: dom.label, count: awaiting.length, detail: `${awaiting.length} ${dom.label} item(s) need a human/counsel decision (permanent gate).` });
      }

      domainCards.push({
        id: dom.id, label: dom.label, group: dom.group, klass: dom.klass,
        mode: policy.mode, permanent_gate: policy.permanent_gate, wired,
        applied, failed, awaiting: awaiting.length, stale,
        agreement: Math.round(agree.agreementRate * 100) / 100, approved_runs: agree.approvedRuns, decisions: agree.humanDecisions,
      });
    }

    exceptions.sort((a, b) => b.severity - a.severity);
    const apply = autoApplyMode();

    return Response.json({
      ok: true,
      global: {
        autonomy_enabled: autonomyEnabled(), kill_switch: autonomyKillSwitch(), ai_paused: paused,
        auto_apply_mode: apply.mode, auto_apply_reason: apply.reason,
        spend_usd: spendUsd, spend_cap: spendCap, spend_pct: spendCap > 0 ? Math.round((spendUsd / spendCap) * 100) : 0,
      },
      summary: {
        domains: DOMAINS.length, auto_domains: autoDomains, earning_domains: earningDomains,
        pending_total: (pendingRows || []).length, exceptions_total: exceptions.length,
        window_decisions: (recent || []).length,
        auto_ok_total: autoOkTotal, auto_ok_wired: autoOkWired,
        coverage_pct: autoOkTotal > 0 ? Math.round((autoOkWired / autoOkTotal) * 100) : 0,
      },
      exceptions: exceptions.slice(0, 50),
      domains: domainCards,
      pending: (pendingRows || []).slice(0, 100).map((r) => ({
        id: r.id, domain: r.domain ?? null, decision_id: r.decision_id ?? null, subject_id: r.subject_id ?? null,
        summary: r.summary ?? "", reason: r.reason ?? "", reversible: r.reversible !== false,
        permanent_gate: r.permanent_gate === true, created_at: r.created_at ?? r.created_date ?? null,
      })),
      note: "Exception-based oversight: watch what needs attention (failures, stale approvals, domains not earning trust, " +
        "spend, brakes) rather than approving everything. Exact per-domain graduation is in autonomyStatus. Not legal advice.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
