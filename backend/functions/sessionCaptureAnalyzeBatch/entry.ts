import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { getNumber } from "../../sdk/settings.ts";
import { Core, aiDailySpendUsd } from "../../sdk/integrations.ts";

// sessionCaptureAnalyzeBatch (INTERNAL/ADMIN, scheduled) — turns the cheap STRUCTURAL snapshots
// (UXHeatmapSnapshot: scroll depth, click coords, dead/rage clicks, element boxes) into UX findings.
// This is almost entirely RULE-BASED, so it costs ~$0 — no per-frame vision LLM. It aggregates by page,
// flags dead-click hotspots, low scroll reach, rage-clicking, and hidden/below-fold primary actions, and
// publishes a design-pressure signal the optimizer/self-learning loop can act on. An optional single
// LLM summary runs only if there's headroom under the spend cap.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const batchSize = Math.max(1, Math.min(500, await getNumber("SESSION_CAPTURE_BATCH_SIZE", 20) * 5));
    const rows = await db.filter("UXHeatmapSnapshot", { analyzed: false }, "at", batchSize).catch(() => []) as any[];

    // Aggregate by page.
    const byPath: Record<string, { n: number; scrollSum: number; dead: number; rage: number; belowFoldCta: number; ctaSeen: number }> = {};
    for (const s of rows) {
      const p = String(s.path || "unknown");
      const a = byPath[p] || (byPath[p] = { n: 0, scrollSum: 0, dead: 0, rage: 0, belowFoldCta: 0, ctaSeen: 0 });
      a.n++;
      a.scrollSum += Number(s.scroll_pct) || 0;
      a.dead += Number(s.dead_clicks) || 0;
      a.rage += Number(s.rage_clicks) || 0;
      // Primary-action visibility: is there a button/link above the fold?
      const els = Array.isArray(s.elements) ? s.elements : [];
      const ctas = els.filter((e: any) => e.tag === "BUTTON" || e.tag === "A");
      if (ctas.length) { a.ctaSeen++; if (!ctas.some((e: any) => e.above_fold)) a.belowFoldCta++; }
    }

    // Rule-based findings (no LLM cost).
    const findings: any[] = [];
    const now = new Date().toISOString();
    const minN = 3;
    for (const [path, a] of Object.entries(byPath)) {
      if (a.n < minN) continue;
      const avgScroll = Math.round(a.scrollSum / a.n);
      const deadPer = a.dead / a.n, ragePer = a.rage / a.n;
      const mk = (area: string, problem: string, suggestion: string, severity: number) =>
        findings.push({ source: "heatmap", path, area, problem, suggestion, severity, at: now });
      if (deadPer >= 1.5) mk("dead_clicks", `Users click non-interactive areas on ${path} (~${deadPer.toFixed(1)}/session)`, "Make the clicked elements actionable or clarify affordances (cursor, styling).", 4);
      if (ragePer >= 1) mk("rage_clicks", `Rage-clicking detected on ${path} (~${ragePer.toFixed(1)}/session)`, "A control looks clickable but isn't responding fast enough or at all — check the primary action.", 5);
      if (avgScroll < 25) mk("low_scroll", `Users barely scroll on ${path} (avg ${avgScroll}%)`, "Move key value/CTA higher; the lower page is rarely seen.", 3);
      if (a.ctaSeen >= minN && a.belowFoldCta / a.ctaSeen > 0.5) mk("cta_below_fold", `Primary action is below the fold for most sessions on ${path}`, "Raise the main button/link above the fold.", 4);
    }

    // Optional single LLM synthesis, only if there's spend headroom (keeps this ~$0).
    let summary: string | null = null;
    const cap = await getNumber("AI_DAILY_SPEND_CAP_USD", 0).catch(() => 0);
    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
    if (hasLLM && findings.length && (cap === 0 || aiDailySpendUsd() < cap * 0.8)) {
      try {
        summary = await Core.InvokeLLM({ prompt: `Summarize the top 3 UX priorities from these heatmap findings in one short paragraph: ${JSON.stringify(findings.slice(0, 12))}` }) as string;
      } catch { /* optional */ }
    }

    // Persist findings + mark snapshots analyzed.
    for (const f of findings) await db.create("UXFinding", { ...f, summary }, "session-capture").catch(() => null);
    for (const s of rows) await db.update("UXHeatmapSnapshot", s.id, { analyzed: true, analyzed_at: now }).catch(() => null);
    if (findings.length) {
      await db.create("OptimizationSignal", { metric: "ux_findings_open", value: findings.length, collected_at: now, source: "heatmap", sample: rows.length }, "session-capture").catch(() => null);
    }

    return Response.json({ success: true, snapshots_analyzed: rows.length, findings: findings.length, summary });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
