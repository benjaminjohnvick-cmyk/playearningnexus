import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { CURRENT_TERMS_VERSION, needsReconsent } from "../../sdk/terms.ts";

// termsStatus (Master Plan 0.5) — does the current user need to (re)accept the current terms version?
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({
      current_terms_version: CURRENT_TERMS_VERSION,
      needs_reconsent: await needsReconsent(user.id),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
