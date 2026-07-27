import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { hasConsented, latestConsent } from "../../sdk/consent-ledger.ts";

// consentStatus (Master Plan 0.3) — the current user's latest consent for a kind (+ optional version).
//   body: { kind, version? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    if (!kind) return Response.json({ error: "kind is required." }, { status: 400 });
    return Response.json({
      kind,
      version: body.version ?? null,
      has_consented: await hasConsented(user.id, kind, body.version ?? undefined),
      latest: await latestConsent(user.id, kind),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
