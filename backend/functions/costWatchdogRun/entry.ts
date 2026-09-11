import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber, snapString } from "../../sdk/settings.ts";
import { aiFloor } from "../../sdk/cost-floor.ts";
import { assessCostFloor, type WatchdogInputs } from "../../sdk/cost-watchdog.ts";

// costWatchdogRun — the cost-floor watchdog. On a schedule it checks that nothing is about to start costing
// money: (1) POSTURE — the free-path config is intact (LLM_PROVIDER=groq, cheap tier on, image=cloudflare, a
// free email sender, no exposed paid key); (2) VOLUME — today's usage vs each free-tier cap, best-effort. It
// writes a CostWatchdogReport and, on any drift/overage/approach, notifies admins. It CHANGES nothing — read +
// alert only. Gated OFF behind COST_WATCHDOG_ENABLED (operational, no counsel needed). Admin only.
//
// An external monitor may POST precise counts in body.usage {aiCallsToday, emailsToday, cfUnitsToday} to
// override the in-app proxies (e.g. real numbers pulled from the provider dashboards/APIs).
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Scheduled service calls have no user; interactive calls must be admin.
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    if (!snapBool("COST_WATCHDOG_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Cost-floor watchdog is OFF. Set COST_WATCHDOG_ENABLED=1 to turn it on (no counsel needed)." });
    }

    const body = await req.json().catch(() => ({}));
    const ov = body?.usage ?? {};
    const nowMs = Date.now();
    const dayStart = new Date(nowMs).toISOString().slice(0, 10) + "T00:00:00.000Z";

    // ── Posture (reliable) ──
    const ai = aiFloor();
    const emailProvider = (snapString("EMAIL_PROVIDER", "ses") || "ses").toLowerCase();

    // ── Usage today (best-effort; -1 = not measured in-app → the report points to the provider dashboard) ──
    const aiCallsToday = num(ov.aiCallsToday, await db.count("AIActivityLog", { created_date: { $gte: dayStart } }).catch(() => -1));
    const emailsToday = num(ov.emailsToday, -1);      // no in-app email log — supply via body.usage or the Brevo dashboard
    const cfUnitsToday = num(ov.cfUnitsToday, -1);    // Cloudflare Workers-AI units — read from the CF dashboard

    const inputs: WatchdogInputs = {
      llmProvider: String(ai.provider || "groq"),
      forceCheapTier: !!ai.forceCheapTier,
      imageProvider: (snapString("IMAGE_PROVIDER", "cloudflare") || "cloudflare").toLowerCase(),
      sttProvider: String(ai.sttProvider || "groq"),
      emailProvider,
      openaiKeySet: !!(Deno.env.get("OPENAI_API_KEY") || "").trim(),
      anthropicKeySet: !!(Deno.env.get("ANTHROPIC_API_KEY") || "").trim(),
      aiCallsToday, emailsToday, cfUnitsToday,
      groqDailyRequests: Math.max(1, Math.round(snapNumber("GROQ_FREE_DAILY_REQUESTS", 14000))),
      emailDailyFree: Math.max(1, Math.round(snapNumber("EMAIL_FREE_DAILY", 300))),
      cfDailyUnits: Math.max(1, Math.round(snapNumber("CF_WORKERS_AI_FREE_DAILY", 10000))),
      warnPct: Math.max(1, Math.min(99, Math.round(snapNumber("COST_WATCHDOG_WARN_PCT", 80)))),
    };

    const result = assessCostFloor(inputs);
    const nowISO = new Date(nowMs).toISOString();

    // Persist the report.
    const report = await db.create("CostWatchdogReport", {
      status: result.status, summary: result.summary, findings: result.findings,
      posture: { llm_provider: inputs.llmProvider, force_cheap_tier: inputs.forceCheapTier, image_provider: inputs.imageProvider, email_provider: inputs.emailProvider, stt_provider: inputs.sttProvider, openai_key_set: inputs.openaiKeySet, anthropic_key_set: inputs.anthropicKeySet },
      usage: { ai_calls_today: aiCallsToday, emails_today: emailsToday, cf_units_today: cfUnitsToday },
      ran_at: nowISO,
    }).catch(() => null);

    // On anything other than green, notify admins (one inbox item; the report has the detail).
    let notified = 0;
    if (result.status !== "green") {
      const admins = await db.filter("User", { role: "admin" }, "-created_date", 20).catch(() => []) as Record<string, unknown>[];
      const title = result.status === "alert" ? "⚠️ Cost-floor watchdog: action needed" : "Cost-floor watchdog: heads-up";
      const drift = result.findings.filter((x) => x.status === "drift" || x.status === "over").map((x) => x.action || x.message);
      const message = `${result.summary}${drift.length ? " → " + drift.slice(0, 3).join(" ") : ""}`;
      for (const a of admins) {
        if (!a.id) continue;
        await base44.asServiceRole.entities.Notification.create({ user_id: String(a.id), type: "cost_watchdog", title, message, is_read: false }).catch(() => null);
        notified++;
      }
    }

    return Response.json({
      ok: true, enabled: true, status: result.status, summary: result.summary,
      findings: result.findings, admins_notified: notified,
      report_id: (report as Record<string, unknown> | null)?.id ?? null, ran_at: nowISO,
      note: "Read-only — the watchdog never changes settings. Drift findings tell you the one env to set to return to $0.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
