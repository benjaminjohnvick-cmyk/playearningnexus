// gift-boost.ts — user-triggered, PLATFORM-funded gift/boost. The compliant alternative to p2p transfers.
//
// A user can send someone a small, capped, NON-CASHABLE bonus — but the value the recipient receives is
// funded by the PLATFORM, not moved out of the sender's wallet. Value flows platform → recipient only; there
// is no wallet-to-wallet transfer, so there is no money transmission. The sender optionally spends their OWN
// non-cashable points as the trigger (a cost to them, never a credit to the recipient). This mirrors the
// group-goals structure (platform funds the reward). Contrast the gated p2p_transfers (real value movement
// between users), which stays OFF. See GIFT-BOOST.md.
import { isEnabled } from "./feature-flags.ts";
import { getNumber } from "./settings.ts";
import { db } from "./db.ts";

export const RECIPIENT_GRANT_FIELD = "current_balance"; // closed-loop, non-cashable Site Cash
export const SENDER_POINTS_FIELD = "points";            // sender's own non-cashable points (optional trigger cost)

export interface GiftBoostConfig { enabled: boolean; maxUsd: number; dailyCap: number; pointCost: number; }

export async function giftBoostConfig(jurisdiction?: string | null): Promise<GiftBoostConfig> {
  return {
    enabled: await isEnabled("gift_boost", jurisdiction ?? null),
    maxUsd: Math.max(0, await getNumber("GIFT_BOOST_MAX_USD", 5)),
    dailyCap: Math.max(0, await getNumber("GIFT_BOOST_DAILY_CAP", 3)),
    pointCost: Math.max(0, await getNumber("GIFT_BOOST_POINT_COST", 0)),
  };
}

// How many boosts the sender has already sent today (anti-abuse cap).
export async function sentTodayCount(senderId: string): Promise<number> {
  try {
    const rows = await db.filter("GiftBoost", { sender_id: senderId }, "-created_date", 100) || [];
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      const t = Date.parse(String((r as Record<string, unknown>).created_at || "")); return Number.isFinite(t) && t >= since;
    }).length;
  } catch { return 0; }
}

// Resolve a recipient by referral code, user id, or email — must be an existing, different user.
export async function resolveRecipient(idOrCodeOrEmail: string, senderId: string): Promise<Record<string, unknown> | null> {
  const q = String(idOrCodeOrEmail || "").trim();
  if (!q) return null;
  const tries: Array<Record<string, unknown>> = [{ id: q }, { referral_code: q }, { email: q.toLowerCase() }];
  for (const where of tries) {
    try {
      const rows = await db.filter("User", where, "-created_date", 1);
      const u = rows && rows[0];
      if (u && String((u as Record<string, unknown>).id) !== senderId) return u as Record<string, unknown>;
    } catch { /* try next */ }
  }
  return null;
}

export function giftBoostDisclosures(cfg: GiftBoostConfig): string[] {
  return [
    "This sends a gift the PLATFORM funds — not money from your wallet. Nothing moves from your balance to theirs.",
    `The recipient gets up to $${cfg.maxUsd.toLocaleString()} in non-cashable Site Cash, funded by us as a thank-you/boost.`,
    cfg.pointCost > 0 ? `Sending costs you ${cfg.pointCost.toLocaleString()} of your own points (your choice) — this is your cost, never a transfer to them.` : "Sending is free.",
    "Because value flows only from the platform to the recipient, this is a promotional boost — not a user-to-user money transfer.",
    "The bonus stays closed-loop and non-cashable for the recipient, like all Site Cash.",
  ];
}
