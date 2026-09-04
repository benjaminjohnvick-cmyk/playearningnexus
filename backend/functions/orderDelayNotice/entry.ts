import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// orderDelayNotice — scheduled/admin. FTC Mail, Internet, or Telephone Order Merchandise Rule ("30-Day Rule"):
// if an order can't ship within the time promised (or 30 days when none was given), the buyer must be NOTIFIED
// and offered the option to cancel for a full refund. This sweep finds undelivered orders that are past their
// estimated delivery (or past 30 days) and sends that notice once (email + account inbox), telling the buyer
// they can keep waiting or cancel for a full refund (cancelStoreOrder). Notification only — never moves money.
const DAY_MS = 86_400_000;
const FROM_NAME = "Get Goods Gratis (Free)";
const DONE = new Set(["delivered", "completed", "cancelled", "refunded", "blocked_restricted"]);

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const maxProcess = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const now = Date.now();

    const rows = await db.list("Order", "-created_date", maxProcess).catch(() => []) as Record<string, unknown>[];
    let notified = 0, considered = 0;

    for (const order of rows || []) {
      const status = String(order.shipping_status || "");
      if (DONE.has(status)) continue;
      if (order.delay_notice_sent_at) continue; // once per order
      considered++;

      const created = Date.parse(String(order.created_date || order.created_at || "")) || now;
      const eta = Date.parse(String(order.estimated_delivery || order.estimated_delivery_date || "")) || 0;
      // Late if past the promised ETA, or (no ETA) past 30 days from order.
      const late = (eta && now > eta) || (now > created + 30 * DAY_MS);
      if (!late) continue;

      const uid = String(order.user_id || "");
      const u = uid ? (await base44.asServiceRole.entities.User.filter({ id: uid }).then((r: Record<string, unknown>[]) => r?.[0]).catch(() => null)) : null;
      const email = String((u as Record<string, unknown>)?.email || "");
      const name = String((u as Record<string, unknown>)?.full_name || "");
      const item = String(order.product_name || "your order");

      const subject = `An update on ${item} — you can keep waiting or cancel for a full refund`;
      const msg = `${item} is taking longer than expected to ship. You can keep waiting, or cancel now for a full refund to your store credit — no charge remains.`;
      const emailBody = `Hi ${name || "there"},\n\nWe wanted to update you: your order for "${item}" is taking longer than expected to ship.\n\nYou have a choice:\n • Keep waiting — we'll continue to fulfill it and update you when it ships.\n • Cancel now for a FULL refund — issued to your store credit, no charge remains.\n\nTo cancel, open the order in your account and choose Cancel, or reply to this email and we'll take care of it.\n\nThanks for your patience.\n— Get Goods Gratis (Free)`;

      if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject, body: emailBody }).catch(() => null);
      if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "order_delay_notice", title: "Shipping delay — your choice", message: msg, is_read: false }).catch(() => null);
      await db.update("Order", String(order.id), { delay_notice_sent_at: new Date().toISOString(), shipping_status: status === "processing" ? "delayed" : status }).catch(() => null);
      notified++;
    }

    return Response.json({ ok: true, considered, delay_notices_sent: notified, ran_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
