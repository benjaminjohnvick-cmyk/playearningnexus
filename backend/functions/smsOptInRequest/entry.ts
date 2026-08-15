import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { smsOptInConfig, currentConsent, consentView, normalizePhone } from "../../sdk/sms-optin.ts";

// smsOptInRequest (auth) — the user submits their number and explicitly agrees to the SMS consent language.
// Records a PENDING consent with the exact disclosure shown + timestamp + IP (the durable, auditable proof).
// Double opt-in: a confirmation step (smsOptInConfirm) completes it. This does NOT send any SMS — delivering
// the confirmation text and any marketing still requires the sms_marketing flag + a real provider.
//   Body: { phone, agree }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await smsOptInConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "SMS opt-in is not available." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    if (body.agree !== true) return Response.json({ error: "You must agree to the SMS terms to opt in." }, { status: 400 });
    const phone = normalizePhone(String(body.phone));
    if (phone.replace(/\D/g, "").length < 7) return Response.json({ error: "Enter a valid mobile number." }, { status: 400 });

    const uid = String(user.id);
    const nowIso = new Date().toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const fields = {
      user_id: uid, kind: "sms_marketing", status: "pending", phone,
      disclosure_shown: cfg.disclosure, consented_at: nowIso, ip, double_optin: true,
    };
    const existing = await currentConsent(uid);
    if (existing?.id) await db.update("ConsentRecord", String(existing.id), fields, uid);
    else await db.create("ConsentRecord", fields, uid);

    return Response.json({
      success: true,
      consent: consentView({ ...fields, id: existing?.id }),
      note: "Thanks — your consent is recorded. To finish (double opt-in), confirm from the text we'll send once SMS delivery is switched on. No messages are sent until then.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
