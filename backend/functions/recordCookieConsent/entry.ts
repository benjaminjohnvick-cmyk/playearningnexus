import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// recordCookieConsent — records a visitor's cookie/tracking privacy choice to the append-only consent ledger
// for auditability (GDPR "demonstrate consent" / CCPA record-keeping). Works for signed-in users and
// anonymous visitors (anon → a stable-ish anon id from the body, else "anon"). Never blocks; the client's
// localStorage choice is authoritative for gating, this is the durable audit trail.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));

    const uid = user?.id ? String(user.id) : (body.anon_id ? `anon:${String(body.anon_id).slice(0, 64)}` : "anon");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    const choice = {
      analytics: body.analytics === true,
      sale_share_optout: body.sale_share_optout === true,
      sensitive_limit: body.sensitive_limit === true,
      action: String(body.action ?? "save_preferences").slice(0, 40),
    };

    await recordConsent({
      user_id: uid, kind: "cookie_privacy_choice", version: "cookie-consent-1",
      accepted: choice.analytics, shown: "cookie-consent-1", ip, meta: choice,
    }).catch(() => null);

    return Response.json({ ok: true, recorded: choice });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
