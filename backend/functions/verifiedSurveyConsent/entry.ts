import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordConsent, hasConsented } from "../../sdk/consent-ledger.ts";
import { CONSENT_KINDS, CONSENT_VERSION, BIOMETRIC_DISCLOSURE, consentsForMethod, verifiedSurveysEnabled } from "../../sdk/verified-survey.ts";

// verifiedSurveyConsent — the biometric/capture consent gate for verified (voice/video) surveys.
//   Body: { action: "status" | "accept", method?: "voice"|"video"|"screen" }
//     status → which of the required consents this user currently has, + the disclosure to show
//     accept → append an ACCEPTED ConsentRecord for each required consent kind (append-only ledger)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await verifiedSurveysEnabled())) {
      return Response.json({ blocked: true, message: "Verified surveys aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const method = String(body.method || "voice");
    const required = consentsForMethod(method);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    if (body.action === "accept") {
      for (const kind of required) {
        await recordConsent({
          user_id: user.id, kind, version: CONSENT_VERSION, accepted: true,
          shown: { disclosure: BIOMETRIC_DISCLOSURE, method }, ip,
          meta: { feature: "verified_survey", method },
        });
      }
      return Response.json({ success: true, accepted: required, version: CONSENT_VERSION });
    }

    // status
    const have: Record<string, boolean> = {};
    for (const kind of Object.values(CONSENT_KINDS)) have[kind] = await hasConsented(user.id, kind, CONSENT_VERSION);
    const missing = required.filter((k) => !have[k]);
    return Response.json({
      required, have, missing,
      all_present: missing.length === 0,
      version: CONSENT_VERSION,
      disclosure: BIOMETRIC_DISCLOSURE,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
