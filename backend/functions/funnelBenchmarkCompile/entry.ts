import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { productGraph, findProduct } from "../../sdk/ai-funnel.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { earnHistory } from "../../sdk/goods-advance.ts";
import { snapBool, snapNumber, snapString, setSetting } from "../../sdk/settings.ts";

// funnelBenchmarkCompile (INTERNAL/ADMIN, meant to be SCHEDULED) — the AI that keeps the site's "results
// information" current on its own. It aggregates REAL per-customer results per product from customers who
// have COMPLETED the product's window, and — only once the sample is big enough — publishes a substantiated
// benchmark (median by default) WITH a self-describing basis, into the settings the concierge already reads.
// Below the threshold it publishes nothing for that product, so the concierge keeps showing the hypothetical
// example. This is what makes a "typical" figure genuinely substantiated: real data, adequate N, stated basis.
//   Body: { dry_run?: boolean }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    if (!(await isEnabled("ai_funnel"))) return Response.json({ skipped: true, reason: "ai_funnel off" });
    if (!snapBool("AI_FUNNEL_AUTO_BENCHMARKS", true)) return Response.json({ skipped: true, reason: "AI_FUNNEL_AUTO_BENCHMARKS off" });

    const minSample = Math.max(1, snapNumber("AI_FUNNEL_BENCHMARK_MIN_SAMPLE", 30));
    const method = (snapString("AI_FUNNEL_BENCHMARK_METHOD", "median") === "average") ? "average" : "median";
    const requireApproval = snapBool("AI_FUNNEL_BENCHMARK_REQUIRE_APPROVAL", false);
    const nowISO = new Date().toISOString();
    const today = nowISO.slice(0, 10);

    const journeys = await db.filter("FunnelJourney", { kind: "active" }, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];

    // Gather each customer's real result, grouped by product (only windows that have CLOSED).
    const byProduct: Record<string, number[]> = {};
    const seen = new Set<string>();
    for (const j of journeys) {
      const userId = String(j.user_id ?? "");
      const key = String(j.current_key ?? "");
      const product = findProduct(key);
      if (!userId || !product) continue;
      const dedup = `${userId}:${key}`;
      if (seen.has(dedup)) continue;
      const windowStart = String(j.window_start ?? j.committed_at ?? "");
      const windowDays = Number(j.window_days) || product.window_days;
      const startMs = Date.parse(windowStart);
      if (!Number.isFinite(startMs) || (Date.now() - startMs) < windowDays * 86400000) continue; // window still open
      seen.add(dedup);
      const result = product.metric === "attributed_sales"
        ? await attributedSalesUsd(db, userId, windowStart).catch(() => 0)
        : Number((await earnHistory(userId, Math.max(1, windowDays)).catch(() => ({ totalUsd: 0 } as { totalUsd: number }))).totalUsd) || 0;
      (byProduct[key] ||= []).push(Math.max(0, result));
    }

    const computed: Array<Record<string, unknown>> = [];
    const publishMap: Record<string, { value: number; basis: string }> = {};

    for (const [key, values] of Object.entries(byProduct)) {
      const product = findProduct(key);
      if (!product) continue;
      const n = values.length;
      const eligible = n >= minSample;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
      const average = sorted.length ? sorted.reduce((s, x) => s + x, 0) / sorted.length : 0;
      const value = Math.round((method === "average" ? average : median) * 100) / 100;
      const basis = `${method} result of ${n} customers over their first ${product.window_days} days (as of ${today})`;
      const published = eligible && !requireApproval;

      computed.push({ product_key: key, metric: product.metric, sample_size: n, method, value, window_days: product.window_days, eligible, published, basis });

      if (!dryRun) {
        await db.create("FunnelBenchmark", {
          product_key: key, metric: product.metric, method, value, sample_size: n,
          window_days: product.window_days, basis, eligible, published, computed_at: nowISO,
        }, me?.id ?? undefined).catch(() => null);
      }
      if (eligible && value > 0) publishMap[key] = { value, basis };
    }

    // Publish: write the substantiated-benchmarks setting the concierge reads (unless approval is required).
    let publishedLive = false;
    const eligibleCount = Object.keys(publishMap).length;
    if (!dryRun && !requireApproval && eligibleCount > 0) {
      await setSetting("AI_FUNNEL_SUBSTANTIATED_BENCHMARKS", JSON.stringify(publishMap), me?.id);
      await setSetting("AI_FUNNEL_BENCHMARKS_SUBSTANTIATED", true, me?.id);
      publishedLive = true;
    }

    return Response.json({
      ok: true, dry_run: dryRun, method, min_sample: minSample, require_approval: requireApproval,
      products: computed, published_live: publishedLive, published_count: eligibleCount,
      note: requireApproval
        ? "Approval required: benchmarks recorded as PENDING (FunnelBenchmark). Publish by setting AI_FUNNEL_SUBSTANTIATED_BENCHMARKS."
        : "Products at or above the sample threshold are published as substantiated results; the rest keep showing the hypothetical example.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
