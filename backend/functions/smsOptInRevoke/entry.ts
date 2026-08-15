import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { smsOptInConfig, currentConsent, consentView } from "../../sdk/sms-optin.ts";

// smsOptInRevoke (auth) — the STOP path. Marks SMS consent revoked immediately. Honoring opt-out is mandatory
// (TCPA), so this must always succeed and take effect at once.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await smsOptInConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "SMS opt-in is not available." }, { status: 400 });

    const uid = String(user.id);
    const existing = await currentConsent(uid);
    if (!existing?.id) return Response.json({ success: true, consent: consentView(null), note: "You have no SMS consent on file." });
    const fields = { status: "revoked", revoked_at: new Date().toISOString() };
    await db.update("ConsentRecord", String(existing.id), fields, uid);
    return Response.json({ success: true, consent: consentView({ ...(existing as Record<string, unknown>), ...fields }), note: "Opted out. We won't send you marketing texts. You can opt back in anytime." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
