import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { giftBoostConfig, sentTodayCount, resolveRecipient, giftBoostDisclosures, RECIPIENT_GRANT_FIELD, SENDER_POINTS_FIELD } from "../../sdk/gift-boost.ts";

// giftBoostSend (auth) — send a PLATFORM-funded, capped, non-cashable boost to another user. The platform
// grants the recipient the bonus; the sender optionally spends their OWN points as the trigger. No value
// moves from sender to recipient, so there is no money transmission.
//   Body: { to, amount_usd?, message? }   (to = referral code / user id / email)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await giftBoostConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "Gift/boost is not available." }, { status: 400 });

    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const amount = Math.min(cfg.maxUsd, Math.max(0, Math.round((Number(body.amount_usd) || cfg.maxUsd) * 100) / 100));
    if (amount <= 0) return Response.json({ error: "Nothing to send." }, { status: 400 });

    if (cfg.dailyCap > 0 && (await sentTodayCount(uid)) >= cfg.dailyCap) {
      return Response.json({ error: `You've reached today's limit of ${cfg.dailyCap} boosts.` }, { status: 429 });
    }
    const recipient = await resolveRecipient(String(body.to), uid);
    if (!recipient) return Response.json({ error: "Couldn't find that person (try their referral code, email, or id)." }, { status: 404 });

    // Optional sender cost: spend the sender's OWN points (never credited to the recipient).
    if (cfg.pointCost > 0) {
      const spent = await adjustUserBalance(uid, -cfg.pointCost, { field: SENDER_POINTS_FIELD });
      if (spent === null) return Response.json({ error: `You need ${cfg.pointCost.toLocaleString()} points to send a boost.` }, { status: 400 });
    }

    // Platform funds the recipient's non-cashable bonus. This is a platform→recipient grant, not a transfer.
    const rid = String((recipient as Record<string, unknown>).id);
    await adjustUserBalance(rid, amount, { field: RECIPIENT_GRANT_FIELD });

    const row = await db.create("GiftBoost", {
      sender_id: uid, recipient_id: rid, amount_usd: amount, point_cost: cfg.pointCost,
      message: String(body.message || "").slice(0, 280), funded_by: "platform",
      created_at: new Date().toISOString(),
    }, uid);

    return Response.json({
      success: true, gift_id: (row as Record<string, unknown>)?.id ?? null, amount_usd: amount,
      disclosures: giftBoostDisclosures(cfg),
      note: `Sent a $${amount.toLocaleString()} platform-funded boost. It came from us, not your balance — nothing moved from your wallet.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
