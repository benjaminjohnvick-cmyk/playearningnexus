import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { acceptCurrentTerms, CURRENT_TERMS_VERSION } from "../../sdk/terms.ts";

// acceptTerms (Master Plan 0.5) — record the current user's acceptance of the current terms version.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const record = await acceptCurrentTerms(user.id, ip, body.shown ?? null);
    return Response.json({ success: true, accepted_version: CURRENT_TERMS_VERSION, record });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
