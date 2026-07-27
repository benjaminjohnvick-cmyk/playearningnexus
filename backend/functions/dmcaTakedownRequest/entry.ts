import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapString } from "../../sdk/settings.ts";

// dmcaTakedownRequest (PUBLIC) — accept a DMCA §512(c)(3) takedown notice from a rights holder
// (who may not be a platform user). Captures the required statutory elements, records the notice,
// flags the identified content for the designated agent, and emails the agent.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const {
      complainant_name, complainant_email, complainant_org,
      copyrighted_work, infringing_url, infringing_content_id, content_type,
      good_faith_statement, accuracy_statement, signature,
    } = body;

    // Required §512(c)(3) elements.
    const missing: string[] = [];
    if (!complainant_name) missing.push("complainant_name");
    if (!complainant_email) missing.push("complainant_email");
    if (!copyrighted_work) missing.push("copyrighted_work (identify the work infringed)");
    if (!infringing_url && !infringing_content_id) missing.push("infringing_url or infringing_content_id");
    if (good_faith_statement !== true) missing.push("good_faith_statement (affirm good-faith belief the use is unauthorized)");
    if (accuracy_statement !== true) missing.push("accuracy_statement (accuracy + authority, under penalty of perjury)");
    if (!signature) missing.push("signature (physical or electronic)");
    if (missing.length) return Response.json({ error: "Incomplete DMCA notice.", missing }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const record = await base44.asServiceRole.entities.DMCARequest.create({
      kind: "takedown",
      complainant_name, complainant_email, complainant_org: complainant_org ?? null,
      copyrighted_work,
      infringing_url: infringing_url ?? null,
      infringing_content_id: infringing_content_id ?? null,
      content_type: content_type ?? null,
      good_faith_statement: true, accuracy_statement: true, signature,
      status: "received", ip, at: new Date().toISOString(),
    });

    // Best-effort: flag the identified content for review.
    if (infringing_content_id && content_type) {
      await base44.asServiceRole.entities[content_type].update(infringing_content_id, {
        dmca_flagged: true, dmca_request_id: record.id, status: "under_dmca_review",
      }).catch(() => null);
    }

    // Notify the designated agent.
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: snapString("DMCA_AGENT_EMAIL", snapString("EMAIL_FROM", "admin@gamergain.app")),
      subject: `[DMCA] Takedown notice — ${copyrighted_work}`,
      body: `A DMCA takedown notice was filed.\n\nComplainant: ${complainant_name} (${complainant_email})${complainant_org ? " — " + complainant_org : ""}\nWork: ${copyrighted_work}\nTarget: ${infringing_url || infringing_content_id}\nRequest ID: ${record.id}\n\nReview and act within your posted DMCA policy timeframe.`,
    }).catch(() => null);

    return Response.json({
      success: true, request_id: record.id, status: "received",
      note: "Your notice has been received and will be reviewed by our designated agent.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
