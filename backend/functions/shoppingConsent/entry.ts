import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordConsent, hasConsented, latestConsent } from "../../sdk/consent-ledger.ts";
import { shoppingEnabled, shoppingCashbackPct, shoppingDailyCashbackCapUsd, SHOPPING_CONSENT_PURPOSE } from "../../sdk/shopping.ts";

// shoppingConsent (authenticated) — the explicit opt-in gate for the shopping browser extension.
// The extension may NOT ingest any purchase until the user has granted this consent in-app. Consent is the
// USER's, recorded here — never inferred from the extension, a page, or a tool claiming prior authorization.
//   Body { action: "status" }                → { enabled, consented, cashback_pct, daily_cap_usd, disclosure }
//   Body { action: "grant" }                 → append an ACCEPTED ConsentRecord (kind shopping_tracking)
//   Body { action: "revoke" }                → append a REVOKED record (supersedes; ingestion stops)
const DISCLOSURE =
  "The shopping helper is optional. If you turn it on, it can see the online purchases you make while it's " +
  "active and apply available discounts, and it records only the merchant, order total, and the commission " +
  "earned — never your card details, full cart, or general browsing. You get a share of that commission back " +
  "as Site Cash (store credit, not cash). You can turn it off any time, which stops all tracking.";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    if (action === "grant" || action === "revoke") {
      await recordConsent({
        user_id: user.id,
        kind: SHOPPING_CONSENT_PURPOSE,
        version: "1",
        accepted: action === "grant",
        shown: { disclosure: DISCLOSURE },
        ip,
        meta: { feature: "shopping_extension" },
      });
      return Response.json({ ok: true, consented: action === "grant" });
    }

    // status
    const consented = await hasConsented(user.id, SHOPPING_CONSENT_PURPOSE);
    const latest = await latestConsent(user.id, SHOPPING_CONSENT_PURPOSE);
    return Response.json({
      enabled: shoppingEnabled(),
      consented,
      since: (latest as Record<string, unknown> | null)?.at ?? null,
      cashback_pct: shoppingCashbackPct(),
      daily_cap_usd: shoppingDailyCashbackCapUsd(),
      disclosure: DISCLOSURE,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
