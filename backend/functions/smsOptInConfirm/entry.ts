import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { smsOptInConfig, currentConsent, consentView } from "../../sdk/sms-optin.ts";

// smsOptInConfirm (auth) — complete the double opt-in: flips a pending consent to CONFIRMED with a timestamp.
// This represents the user completing the confirmation step (e.g. replying YES to the confirmation text or
// clicking the confirmation link). Recorded as durable proof of verifiable consent.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await smsOptInConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "SMS opt-in is not available." }, { status: 400 });

    const uid = String(user.id);
    const existing = await currentConsent(uid);
    if (!existing?.id) return Response.json({ error: "No pending opt-in to confirm — submit your number first." }, { status: 404 });
    if (String((existing as Record<string, unknown>).status) === "revoked") return Response.json({ error: "This number opted out. Opt in again to restart." }, { status: 400 });

    const fields = { status: "confirmed", confirmed_at: new Date().toISOString() };
    await db.update("ConsentRecord", String(existing.id), fields, uid);
    return Response.json({ success: true, consent: consentView({ ...(existing as Record<string, unknown>), ...fields }), note: "Confirmed — your SMS consent is verified and on file. You can reply STOP anytime to opt out." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
