import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { smsOptInConfig, currentConsent, consentView } from "../../sdk/sms-optin.ts";

// smsOptInStatus (read) — the caller's current SMS consent + the exact disclosure that would be shown.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await smsOptInConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const consent = consentView(await currentConsent(String(user.id)));
    return Response.json({ enabled: true, disclosure: cfg.disclosure, consent });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
