// save-to-get.ts — "Save-to-Get" item goal: the no-debt replacement for Goods Advance.
//
// The user picks an item and saves toward it from their OWN earnings (closed-loop Site Cash), at their own
// pace — optionally auto-routing a chosen share of new earnings into the goal. When the reserved amount
// reaches the item price, they claim it. Money is only ever the user's own Site Cash moved from spendable
// into a reservation they control; it returns to spendable if they cancel. NOTHING is advanced, nothing is
// owed, nothing is repaid — so this is NOT credit (contrast the gated goods_advance). It's layaway/savings
// the user drives. See SAVE-TO-GET.md.
import { isEnabled } from "./feature-flags.ts";
import { getNumber } from "./settings.ts";
import { db } from "./db.ts";
import { adjustUserBalance } from "./balance.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const SPENDABLE_FIELD = "current_balance";

export interface SaveToGetConfig { enabled: boolean; maxGoals: number; minPriceUsd: number; }

export async function saveToGetConfig(jurisdiction?: string | null): Promise<SaveToGetConfig> {
  return {
    enabled: await isEnabled("save_to_get", jurisdiction ?? null),
    maxGoals: await getNumber("SAVE_TO_GET_MAX_GOALS", 10),
    minPriceUsd: await getNumber("SAVE_TO_GET_MIN_PRICE_USD", 1),
  };
}

export interface GoalView {
  id: string;
  item_name: string;
  item_price_usd: number;
  saved_usd: number;          // the user's own Site Cash reserved toward this item
  remaining_usd: number;      // left to fund the item — NOT owed; just how much more to save to claim
  progress_pct: number;
  auto_pct: number;           // optional share of new earnings auto-routed here (0 = off)
  funded: boolean;            // saved >= price → claimable
  status: string;             // active | funded | claimed | canceled
  message: string;
}

export function goalView(g: Record<string, unknown>): GoalView {
  const price = Math.max(0, Number(g.item_price_usd) || 0);
  const saved = Math.max(0, Number(g.saved_usd) || 0);
  const remaining = Math.max(0, round2(price - saved));
  const funded = price > 0 && saved >= price;
  const status = String(g.status || "active");
  const auto = Math.min(1, Math.max(0, Number(g.auto_pct) || 0));
  let message: string;
  if (status === "claimed") message = "Claimed — enjoy it. This was funded entirely from your own saved Site Cash.";
  else if (status === "canceled") message = "Canceled — your saved amount went back to your spendable balance. Nothing was owed.";
  else if (funded) message = "Fully funded from your savings — claim it whenever you like.";
  else message = `Saved ${round2(saved).toLocaleString()} of ${price.toLocaleString()}. Add more whenever you want, or move it back to spendable — nothing is owed.`;
  return {
    id: String(g.id), item_name: String(g.item_name || "Item"), item_price_usd: price,
    saved_usd: round2(saved), remaining_usd: remaining,
    progress_pct: price > 0 ? Math.min(100, round2((saved / price) * 100)) : 0,
    auto_pct: auto, funded, status, message,
  };
}

export async function activeGoals(userId: string): Promise<Record<string, unknown>[]> {
  try { return await db.filter("SaveToGetGoal", { user_id: userId }, "-created_date", 50) || []; }
  catch { return []; }
}

export function saveToGetDisclosures(): string[] {
  return [
    "You save toward an item from your OWN earnings — it's your Site Cash, reserved for this, not an advance or a loan.",
    "Add to it at your own pace, or auto-route a share of new earnings. You choose; it's off unless you turn it on.",
    "Nothing is owed and nothing is locked: move your saved amount back to spendable anytime before you claim.",
    "When your savings reach the price, you claim the item. You only ever pay with money you already earned.",
    "It stays closed-loop store credit the whole way — saving toward an item doesn't make it cashable.",
  ];
}

// Integration helper: on a new earning, route the user's per-goal auto_pct into their goals (highest-priority
// / oldest active first). Only moves the user's own spendable Site Cash into their own reservation.
export async function applyEarningToGoals(userId: string, earningUsd: number): Promise<{ routed_usd: number }> {
  const cfg = await saveToGetConfig();
  if (!cfg.enabled) return { routed_usd: 0 };
  const goals = (await activeGoals(userId)).filter((g) => String(g.status || "active") === "active" && (Number(g.auto_pct) || 0) > 0);
  let routed = 0;
  for (const g of goals) {
    const price = Math.max(0, Number(g.item_price_usd) || 0);
    const saved = Math.max(0, Number(g.saved_usd) || 0);
    const need = Math.max(0, price - saved);
    if (need <= 0) continue;
    const want = round2(Math.min(need, (Number(earningUsd) || 0) * (Number(g.auto_pct) || 0)));
    if (want <= 0) continue;
    const debited = await adjustUserBalance(userId, -want, { field: SPENDABLE_FIELD, floorZero: true });
    if (debited === null) continue;
    const newSaved = round2(saved + want);
    await db.update("SaveToGetGoal", String(g.id), { saved_usd: newSaved, status: newSaved >= price ? "funded" : "active" }, userId);
    routed += want;
  }
  return { routed_usd: round2(routed) };
}
