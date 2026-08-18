import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordContentLicense, contentLicenseVersion, contentLicenseText } from "../../sdk/content-license.ts";

// recordContentLicense (auth) — log a content-license/rights attestation for uploaded content (ad creatives,
// storefront media). Called by the uploader's client after they check the rights-attestation box. GET-style
// (no accepted flag) returns the current license text + version to display. Records to the consent ledger.
//   {}                                        → { version, license_text }
//   { accepted:true, content_type, content_ref? } → { ok, version }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.accepted !== true) {
      return Response.json({ version: contentLicenseVersion(), license_text: contentLicenseText() });
    }
    await recordContentLicense({
      userId: String(user.id),
      contentType: String(body.content_type || "upload"),
      contentRef: body.content_ref ? String(body.content_ref) : null,
    });
    return Response.json({ ok: true, version: contentLicenseVersion() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
