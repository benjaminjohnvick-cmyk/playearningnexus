import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// recordConsent (Master Plan 0.3) — append a consent/disclosure record for the current user.
//   body: { kind, version?, accepted?, shown?, meta? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (!body.kind) {
      return Response.json({ error: "kind is required (e.g. 'terms','sms_optin','auto_renewal')." }, { status: 400 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const record = await recordConsent({
      user_id: user.id,
      kind: String(body.kind),
      version: body.version ?? null,
      accepted: body.accepted !== false,
      shown: body.shown ?? null,
      ip,
      meta: body.meta ?? {},
    });
    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
