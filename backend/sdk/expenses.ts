// expenses.ts — a tiny expense ledger for the growth-budget engine. Records real business costs (marketing,
// infra, other) so the engine can subtract them from revenue and compute CAC. Admin-only entity.

import { db } from "./db.ts";

export type ExpenseCategory = "marketing" | "infra" | "ai" | "ops" | "other";

export function normalizeExpenseCategory(c: unknown): ExpenseCategory {
  const v = String(c || "").toLowerCase();
  return (v === "marketing" || v === "infra" || v === "ai" || v === "ops") ? v : "other";
}

/** Record one expense (USD). */
export async function recordExpense(input: { amount_usd: number; category?: unknown; note?: string; ref?: string | null; at?: string }): Promise<string | null> {
  const amount = Math.round((Number(input.amount_usd) || 0) * 100) / 100;
  if (amount <= 0) return null;
  try {
    const row = await db.create("Expense", {
      amount_usd: amount,
      category: normalizeExpenseCategory(input.category),
      note: String(input.note || "").slice(0, 500),
      ref: input.ref ?? null,
      at: input.at || new Date().toISOString(),
    });
    return (row as Record<string, unknown>)?.id as string ?? null;
  } catch { return null; }
}

/** Sum expenses over an optional window (ms cutoff); returns total + marketing subtotal. */
export function sumExpenses(rows: Record<string, unknown>[], cutoffMs = 0): { total: number; marketing: number } {
  let total = 0, marketing = 0;
  for (const e of (rows || [])) {
    const at = e.at ? new Date(String(e.at)).getTime() : (e.created_date ? new Date(String(e.created_date)).getTime() : 0);
    if (cutoffMs && at && at < cutoffMs) continue;
    const amt = Number(e.amount_usd) || 0;
    total += amt;
    if (normalizeExpenseCategory(e.category) === "marketing") marketing += amt;
  }
  return { total: Math.round(total * 100) / 100, marketing: Math.round(marketing * 100) / 100 };
}
