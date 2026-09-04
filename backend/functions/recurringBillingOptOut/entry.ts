import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// recurringBillingOptOut (authenticated) — the unified "click to cancel" path for recurring charges (the
// control auto-renewal law requires). Turns OFF auto-renew across the caller's recurring surfaces so no future
// rebill can occur: their PPC Grid subscription flag, any active generic Subscription, and any active
// BusinessSubscription. Never charges or refunds; effective for the next cycle. Turning renewal back ON is
// done at the surface's own subscribe/consent path (which captures fresh express consent).
//   { }  → status   |   { opt_out: true }  → cancel auto-renew everywhere for this user
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const nowISO = new Date().toISOString();

    const surfaces: Record<string, number> = { subscriptions: 0, business_subscriptions: 0, ppc_grid: 0 };

    if (body.opt_out === true) {
      // 1) Generic subscriptions
      const subs = await db.filter("Subscription", { user_id: uid, is_active: true }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      for (const s of subs) {
        await db.update("Subscription", String(s.id), { auto_renew: false, auto_renew_optout: true, auto_renew_choice_at: nowISO }).catch(() => null);
        surfaces.subscriptions++;
      }
      // 2) Business subscriptions
      const biz = await db.filter("BusinessSubscription", { owner_user_id: uid, status: "active" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      for (const b of biz) {
        await db.update("BusinessSubscription", String(b.id), { auto_renew_optout: true, auto_renew_choice_at: nowISO }).catch(() => null);
        surfaces.business_subscriptions++;
      }
      // 3) PPC Grid recurring flag on the user
      await base44.asServiceRole.entities.User.update(uid, { auto_renew_optout: true, ppc_auto_renew_consent: false, auto_renew_choice_at: nowISO }).catch(() => null);
      surfaces.ppc_grid = 1;

      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      await recordConsent({
        user_id: uid, kind: "recurring_billing_optout", version: "recurring-optout-1", accepted: false,
        shown: "recurring-optout-1", ip, meta: { surfaces },
      }).catch(() => null);

      return Response.json({
        ok: true, opted_out: true, surfaces,
        note: "Auto-renewal is turned off for your recurring subscriptions. Nothing further will be charged. You can re-subscribe any time.",
      });
    }

    // Read-only status
    const [subs, biz] = await Promise.all([
      db.filter("Subscription", { user_id: uid, is_active: true }, "-created_date", 50).catch(() => []),
      db.filter("BusinessSubscription", { owner_user_id: uid, status: "active" }, "-created_date", 50).catch(() => []),
    ]) as Record<string, unknown>[][];
    return Response.json({
      ok: true,
      active_subscriptions: subs.length,
      active_business_subscriptions: biz.length,
      ppc_grid_active: user.ppc_grid_active === true,
      ppc_auto_renew_consent: user.ppc_auto_renew_consent === true,
      opted_out: user.auto_renew_optout === true,
      note: "POST { opt_out: true } to turn off auto-renewal across all your recurring subscriptions (no charge).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
