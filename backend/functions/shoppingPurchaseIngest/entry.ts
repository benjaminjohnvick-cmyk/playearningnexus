import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { hasConsented } from "../../sdk/consent-ledger.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import {
  shoppingEnabled, shoppingConsentRequired, shoppingDailyCashbackCapUsd,
  cashbackSplit, estimateCommission, SHOPPING_CONSENT_PURPOSE,
} from "../../sdk/shopping.ts";

// shoppingPurchaseIngest (authenticated) — records ONE purchase the opt-in shopping extension observed and
// credits the user's cashback share as closed-loop Site Cash. This is the app-side endpoint; the extension
// (which needs affiliate partnerships + store review + a privacy review) posts to it.
//
// GATING (do not weaken): the feature must be enabled AND — when SHOPPING_CONSENT_REQUIRED is on — the user
// must have an explicit in-app consent (ConsentRecord kind shopping_tracking). No consent → nothing stored,
// nothing credited. DATA-MINIMIZED: we persist merchant, order total, commission, cashback, network, a
// coarse ref and day — never full carts, item lists, card data, or browsing history.
//
//   Body { merchant, order_total_usd, currency?, commission_usd?, merchant_rate?, network?, order_ref? }
//     → { ok, cashback_usd, capped }   |   { skipped, reason }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!shoppingEnabled()) return Response.json({ skipped: true, reason: "disabled" });

    if (shoppingConsentRequired() && !(await hasConsented(user.id, SHOPPING_CONSENT_PURPOSE))) {
      return Response.json({ skipped: true, reason: "no_consent" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const merchant = String(body.merchant || "").slice(0, 120).trim();
    const orderTotal = Math.max(0, Math.round((Number(body.order_total_usd) || 0) * 100) / 100);
    const currency = String(body.currency || "USD").slice(0, 8);
    const network = String(body.network || "").slice(0, 60);
    const orderRef = String(body.order_ref || "").slice(0, 80);   // opaque ref for dedupe/reconciliation only
    if (!merchant || orderTotal <= 0) {
      return Response.json({ skipped: true, reason: "invalid_purchase" }, { status: 400 });
    }

    // Prefer the network-reported commission; else estimate from a merchant rate (fraction of order).
    const commission = Number(body.commission_usd) > 0
      ? Math.round(Number(body.commission_usd) * 100) / 100
      : estimateCommission(orderTotal, Number(body.merchant_rate) || 0);
    const split = cashbackSplit(commission);

    const day = new Date().toISOString().slice(0, 10);

    // Enforce the daily cashback cap (fraud/abuse guard).
    const cap = shoppingDailyCashbackCapUsd();
    const todays = await db.filter("AffiliatePurchase", { user_id: user.id, day }, "-created_date", 500)
      .catch(() => []) as Record<string, unknown>[];
    const already = (todays || []).reduce((s, r) => s + (Number(r.cashback_usd) || 0), 0);
    let cashback = split.user_cashback_usd;
    let capped = false;
    if (cap > 0 && already + cashback > cap) {
      cashback = Math.max(0, Math.round((cap - already) * 100) / 100);
      capped = true;
    }

    // Record the (data-minimized) purchase.
    await base44.asServiceRole.entities.AffiliatePurchase.create({
      user_id: user.id, merchant, order_total_usd: orderTotal, currency,
      commission_usd: split.commission_usd, cashback_usd: cashback, platform_usd: split.platform_usd,
      network, order_ref: orderRef, day, consent_kind: SHOPPING_CONSENT_PURPOSE,
    }).catch(() => null);

    // Credit the cashback as closed-loop Site Cash (never a cash payout).
    if (cashback > 0) {
      await adjustUserBalance(user.id, cashback, { field: "current_balance" }).catch(() => null);
    }

    return Response.json({ ok: true, cashback_usd: cashback, commission_usd: split.commission_usd, capped });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
