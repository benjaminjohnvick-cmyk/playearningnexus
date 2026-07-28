import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { getNumber } from "../../sdk/settings.ts";
import { Core, aiDailySpendUsd } from "../../sdk/integrations.ts";

// sessionCaptureAnalyzeBatch (INTERNAL/ADMIN, scheduled) — reviews a BATCH of sampled session frames
// for UX/design problems (confusing layout, dead ends, friction) and turns findings into design
// signals the self-learning loop can act on. Hard-capped: it stops as soon as spend reaches
// SESSION_CAPTURE_DAILY_BUDGET_USD (or the global AI_DAILY_SPEND_CAP_USD). This batching + ceiling is
// what keeps "capture what users see" affordable at any traffic level.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const batchSize = Math.max(1, Math.min(200, await getNumber("SESSION_CAPTURE_BATCH_SIZE", 20)));
    const subBudget = Math.max(0, await getNumber("SESSION_CAPTURE_DAILY_BUDGET_USD", 0));
    const globalCap = Math.max(0, await getNumber("AI_DAILY_SPEND_CAP_USD", 0));
    const startSpend = aiDailySpendUsd();
    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));

    // Budget gate: if we've already hit either ceiling, do nothing this run.
    const overSub = subBudget > 0 && (aiDailySpendUsd() - startSpend) >= subBudget;
    const overGlobal = globalCap > 0 && aiDailySpendUsd() >= globalCap;
    if (!hasLLM || overGlobal) {
      return Response.json({ success: true, analyzed: 0, reason: !hasLLM ? "no_llm" : "global_cap_reached" });
    }

    const frames = await db.filter("SessionCaptureFrame", { analyzed: false }, "at", batchSize).catch(() => []) as any[];
    let analyzed = 0;
    const findings: string[] = [];

    for (const f of frames) {
      // Re-check the spend ceilings before EACH call so the cap is a true hard stop.
      if (subBudget > 0 && (aiDailySpendUsd() - startSpend) >= subBudget) break;
      if (globalCap > 0 && aiDailySpendUsd() >= globalCap) break;

      try {
        const out = await Core.InvokeLLM({
          prompt:
            `You are a UX analyst reviewing a captured web-app screen from a play-to-earn marketplace. Page: ${f.path || "unknown"}. ` +
            `${f.url ? "Screenshot: " + f.url : "(No image available — infer from the page path only.)"} ` +
            `Identify at most 2 concrete, testable UX/design issues (e.g. unclear CTA, cluttered layout, hidden value, friction). ` +
            `Return JSON: { issues: [{ area, problem, suggestion, severity(1-5) }] }`,
          response_json_schema: {
            type: "object",
            properties: {
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: { area: { type: "string" }, problem: { type: "string" }, suggestion: { type: "string" }, severity: { type: "number" } },
                  required: ["area", "problem", "suggestion"],
                },
              },
            },
            required: ["issues"],
          },
        }) as any;

        const issues = Array.isArray(out?.issues) ? out.issues.slice(0, 2) : [];
        for (const it of issues) {
          await db.create("UXFinding", {
            source: "session_capture", path: f.path || null, area: String(it.area || "").slice(0, 120),
            problem: String(it.problem || "").slice(0, 400), suggestion: String(it.suggestion || "").slice(0, 400),
            severity: Math.max(1, Math.min(5, Number(it.severity) || 3)), session_id: f.session_id, at: new Date().toISOString(),
          }, "session-capture").catch(() => null);
          findings.push(`${it.area}: ${it.problem}`);
        }
        await db.update("SessionCaptureFrame", f.id, { analyzed: true, analyzed_at: new Date().toISOString() }).catch(() => null);
        analyzed++;
      } catch (_e) {
        // A cap-reached rejection ends the run cleanly.
        break;
      }
    }

    // Publish a design-pressure signal so the optimizer/site-model see how much UX friction exists.
    if (analyzed > 0) {
      await db.create("OptimizationSignal", {
        metric: "ux_findings_open", value: findings.length, collected_at: new Date().toISOString(), source: "session_capture", sample: analyzed,
      }, "session-capture").catch(() => null);
    }

    return Response.json({
      success: true,
      analyzed,
      findings: findings.slice(0, 20),
      spend_used_usd: Math.round((aiDailySpendUsd() - startSpend) * 100) / 100,
      stopped_on_budget: (subBudget > 0 && (aiDailySpendUsd() - startSpend) >= subBudget) || (globalCap > 0 && aiDailySpendUsd() >= globalCap),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
