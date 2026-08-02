// provider-advisor.ts — watches REAL hosted-inference spend per capability and recommends flipping to your
// own self-hosted GPU once it would be cheaper than the hosted bills.
//
// The self-hosted (`self`) backends are already coded in (see providers.ts). This module is the "when should
// I turn one on?" signal for the admin panel. It records only REAL money spent — calls served free (Groq
// free tier) or already self-hosted record nothing, so a recommendation only appears once a capability is
// actually costing you more per month than a GPU would. See SELF-HOSTED-PROVIDERS.md.

import { db } from "./db.ts";
import { snapNumber } from "./settings.ts";

export type Capability = "llm" | "stt" | "tts" | "image";

const round6 = (n: number) => Math.round((Number(n) || 0) * 1e6) / 1e6;
const monthKey = (d: Date = new Date()) => d.toISOString().slice(0, 7);

/** Reference monthly cost of a self-hosted GPU (rented or amortized) — the break-even to beat. */
export const gpuMonthlyCostUsd = () => Math.max(0, snapNumber("GPU_MONTHLY_COST_USD", 400));
/** Recommend self-hosting once projected monthly spend ≥ GPU cost × this margin (headroom to avoid churn). */
export const advisorMargin = () => Math.max(1, snapNumber("SELFHOST_RECOMMEND_MARGIN", 1.2));
/** Per-image cost estimate for the image capability meter. */
export const imageCostUsd = () => Math.max(0, snapNumber("IMAGE_COST_USD", 0.01));

/** Record REAL money spent on a hosted call. No-op for free/self calls (realUsd ≤ 0), so free-tier usage
 *  never triggers a recommendation. Best-effort — never throws into the hot path. */
export async function recordProviderUse(capability: Capability, realUsd: number): Promise<void> {
  const usd = round6(realUsd);
  if (usd <= 0) return;
  const month = monthKey();
  try {
    const rows = await db.filter("ProviderUsage", { month, capability }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const row = rows?.[0];
    if (row?.id) {
      await db.incrementField("ProviderUsage", row.id as string, "real_spend_usd", usd);
      await db.incrementField("ProviderUsage", row.id as string, "calls", 1);
    } else {
      await db.create("ProviderUsage", { month, capability, real_spend_usd: usd, calls: 1 });
    }
  } catch { /* best-effort metering */ }
}

export interface CapAdvice {
  capability: Capability;
  month_spend_usd: number;
  projected_monthly_usd: number;   // simple run-rate projection to end of month
  gpu_break_even_usd: number;
  recommend_self_host: boolean;
  headline: string;
}

const DAYS_IN_MONTH = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** Turn a capability's month-to-date spend into a recommendation. */
export function adviseCapability(capability: Capability, monthSpendUsd: number, now: Date = new Date()): CapAdvice {
  const spend = Math.max(0, Number(monthSpendUsd) || 0);
  const dom = now.getDate();
  const dim = DAYS_IN_MONTH(now);
  const projected = dom > 0 ? round6((spend / dom) * dim) : spend;
  const gpu = gpuMonthlyCostUsd();
  const threshold = gpu * advisorMargin();
  const recommend = gpu > 0 && projected >= threshold;
  const headline = recommend
    ? `Projected ~$${projected.toFixed(0)}/mo hosted — above the ~$${gpu.toFixed(0)}/mo self-hosted GPU break-even. Consider switching this to self.`
    : spend <= 0
      ? "No hosted spend this month (free tier / self-hosted). Stay put."
      : `~$${projected.toFixed(0)}/mo projected — still under the ~$${gpu.toFixed(0)}/mo GPU break-even. Hosted is cheaper; stay put.`;
  return { capability, month_spend_usd: round6(spend), projected_monthly_usd: projected, gpu_break_even_usd: gpu, recommend_self_host: recommend, headline };
}

/** Read this month's real spend per capability. */
export async function monthlyUsage(month: string = monthKey()): Promise<Record<Capability, number>> {
  const rows = await db.filter("ProviderUsage", { month }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
  const out: Record<Capability, number> = { llm: 0, stt: 0, tts: 0, image: 0 };
  for (const r of rows || []) {
    const cap = String(r.capability || "") as Capability;
    if (cap in out) out[cap] += Number(r.real_spend_usd) || 0;
  }
  return out;
}
