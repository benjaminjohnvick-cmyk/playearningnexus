import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue } from "../../sdk/revenue.ts";
import { giftBlockedReason, splitGift, giftFeePct } from "../../sdk/gifting.ts";

// giftSiteCash (authenticated) — the sender gifts closed-loop Site Cash (current_balance) to another user by
// email or id. Store credit moves BETWEEN accounts — never money, never a cash-out — so it stays in the closed
// loop. The sender is debited the full gross ATOMICALLY (fails on insufficient funds); the recipient is credited
// the NET; the platform keeps the spread, booked as `breakage`. If the recipient credit fails, the sender is
// refunded so no one loses balance. { to_email? , to_user_id? , amount_usd, note? } → { ok, sent } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sender = await base44.auth.me();
    if (!sender) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const amount = Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    const blocked = giftBlockedReason(amount);
    if (blocked) return Response.json({ error: blocked }, { status: 400 });

    // Resolve the recipient by id or email.
    let recipient: Record<string, unknown> | null = null;
    if (body.to_user_id) {
      recipient = await db.get("User", String(body.to_user_id)).catch(() => null);
    } else if (body.to_email) {
      const rows = await base44.asServiceRole.entities.User.filter({ email: String(body.to_email).trim().toLowerCase() }).catch(() => []) as Record<string, unknown>[];
      recipient = rows && rows[0] ? rows[0] : null;
    }
    if (!recipient) return Response.json({ error: "We couldn't find that person. Check the email or link." }, { status: 404 });
    if (String(recipient.id) === String(sender.id)) return Response.json({ error: "You can't gift Site Cash to yourself." }, { status: 400 });

    const { gross, fee, net, pct } = splitGift(amount);
    const sid = String(sender.id), rid = String(recipient.id);

    // ATOMIC debit of the sender's full gross. Null = insufficient funds (no floor) or contention.
    const senderNew = await adjustUserBalance(sid, -gross, { field: "current_balance" });
    if (senderNew === null) {
      const bal = Math.max(0, Number((sender as Record<string, unknown>).current_balance) || 0);
      return Response.json({ error: `Not enough Site Cash. This gift costs $${gross.toFixed(2)} and you have $${bal.toFixed(2)}.` }, { status: 402 });
    }

    // Credit the recipient the NET. If it fails, refund the sender in full so nobody loses balance.
    const recNew = await adjustUserBalance(rid, net, { field: "current_balance" });
    if (recNew === null) {
      await adjustUserBalance(sid, gross, { field: "current_balance" }).catch(() => null);
      return Response.json({ error: "Couldn't deliver the gift — you were refunded." }, { status: 500 });
    }

    // Record the gift + the closed-loop spread (breakage). Best-effort ledger writes.
    const note = String(body.note || "").slice(0, 200);
    await db.create("SiteCashGift", {
      from_user_id: sid, to_user_id: rid, gross_usd: gross, fee_usd: fee, net_usd: net, fee_pct: pct,
      note, at: new Date().toISOString(),
    }).catch(() => null);
    if (fee > 0) await recordRevenue({ type: "breakage", amount_usd: fee, user_id: sid, ref: `gift:${rid}`, meta: { source: "site_cash_gift", gross_usd: gross, net_usd: net, fee_pct: pct } }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: rid, type: "site_cash_gift", is_read: false,
      title: "You received a Site-Cash gift!",
      message: `${String((sender as Record<string, unknown>).full_name || "A member")} sent you $${net.toFixed(2)} in Site Cash${note ? `: "${note}"` : "."}`,
    }).catch(() => null);

    return Response.json({
      ok: true, sent: { to: rid, gross_usd: gross, fee_usd: fee, net_usd: net, fee_pct: pct },
      new_balance_usd: Math.round((Number(senderNew) || 0) * 100) / 100,
      note: "Closed-loop store credit moved between accounts (never cash).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
