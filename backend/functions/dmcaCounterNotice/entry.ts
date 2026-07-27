import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapString } from "../../sdk/settings.ts";

// dmcaCounterNotice — a user whose content was removed files a §512(g) counter-notice. Captures the
// required elements (identification, good-faith-mistake statement under penalty of perjury, consent
// to jurisdiction + service of process, signature) and notifies the designated agent.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { dmca_request_id, removed_material, prior_location, good_faith_mistake_statement, consent_to_jurisdiction, signature } = body;

    const missing: string[] = [];
    if (!dmca_request_id && !removed_material) missing.push("dmca_request_id or removed_material");
    if (good_faith_mistake_statement !== true) missing.push("good_faith_mistake_statement (penalty of perjury: removed by mistake/misidentification)");
    if (consent_to_jurisdiction !== true) missing.push("consent_to_jurisdiction (consent to federal court + acceptance of service)");
    if (!signature) missing.push("signature");
    if (missing.length) return Response.json({ error: "Incomplete counter-notice.", missing }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const record = await base44.asServiceRole.entities.DMCARequest.create({
      kind: "counter_notice",
      user_id: user.id,
      related_request_id: dmca_request_id ?? null,
      removed_material: removed_material ?? null,
      prior_location: prior_location ?? null,
      good_faith_mistake_statement: true, consent_to_jurisdiction: true, signature,
      status: "received", ip, at: new Date().toISOString(),
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: snapString("DMCA_AGENT_EMAIL", snapString("EMAIL_FROM", "admin@gamergain.app")),
      subject: `[DMCA] Counter-notice — request ${dmca_request_id ?? record.id}`,
      body: `A DMCA counter-notice was filed by user ${user.email}.\nRequest ID: ${record.id}\nRelated takedown: ${dmca_request_id ?? "n/a"}\n\nPer §512(g), restore the material in 10–14 business days unless the complainant files a court action.`,
    }).catch(() => null);

    return Response.json({ success: true, request_id: record.id, status: "received" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
