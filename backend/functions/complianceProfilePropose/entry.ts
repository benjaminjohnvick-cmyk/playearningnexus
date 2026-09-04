import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { profileForCountry } from "../../sdk/country-compliance.ts";

// complianceProfilePropose (ADMIN, GATED) — the AI compliance research assistant, done SAFELY. Given a country,
// it DRAFTS a proposed compliance-profile update and writes it to a REVIEW QUEUE (ComplianceProfileProposal)
// as status 'pending_review'. It NEVER changes live legal behavior — a human/counsel must approve a proposal
// before it becomes an active ComplianceProfile override. Deliberately not autonomous: an AI silently rewriting
// the site's legal posture from web content would create liability, so approval stays human.
//   { country: "FR" } → { ok, proposal }   (requires COMPLIANCE_AI_RESEARCH_ENABLED + admin)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
    if (!snapBool("COMPLIANCE_AI_RESEARCH_ENABLED", false)) {
      return Response.json({ error: "AI compliance research is off (counsel-gated). Enable COMPLIANCE_AI_RESEARCH_ENABLED with counsel approval." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cc = String(body.country ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return Response.json({ error: "Provide a valid ISO-3166 alpha-2 country (e.g. 'FR')." }, { status: 400 });

    const current = profileForCountry(cc);

    // Ask the model to draft a STRICT, conservative profile. Output is a PROPOSAL only.
    const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a compliance research assistant drafting a PROPOSED consumer-privacy + payments compliance profile for country code ${cc}, for a global 18+ play-to-earn/survey/advertising platform. Draft the STRICTEST reasonable posture. Return: privacy_regime (short label), cookie_model ("opt_in" or "opt_out"; prefer opt_in when unsure), age_of_majority (integer, never below 18), sca_required (boolean; true if the country/region requires Strong Customer Authentication / 3-D Secure on card payments, else your best conservative guess = true), data_transfer_note (one sentence), and a 2-3 sentence rationale. This is a DRAFT for human legal review, not legal advice; be conservative and flag uncertainty.`,
      response_json_schema: {
        type: "object",
        properties: {
          privacy_regime: { type: "string" },
          cookie_model: { type: "string", enum: ["opt_in", "opt_out"] },
          age_of_majority: { type: "number" },
          sca_required: { type: "boolean" },
          data_transfer_note: { type: "string" },
          rationale: { type: "string" },
        },
      },
    }).catch(() => null);

    const draft = ai?.data ?? null;
    // Enforce the floor even on the proposal (age >= 18).
    if (draft && typeof draft === "object") {
      (draft as Record<string, unknown>).age_of_majority = Math.max(18, Number((draft as Record<string, unknown>).age_of_majority) || 18);
    }

    const now = new Date().toISOString();
    const proposal = await db.create("ComplianceProfileProposal", {
      country: cc,
      current_profile: current,
      proposed: draft,
      status: "pending_review",       // NEVER auto-applied; a human approves → writes a ComplianceProfile row
      generated_by: "ai_research_assistant",
      requested_by: user.id,
      created_at: now,
    }, user.id).catch(() => null);

    return Response.json({
      ok: true,
      note: "This is a PROPOSAL only — it does not change live behavior. A human/counsel must review and approve it before it becomes an active ComplianceProfile override.",
      proposal_id: (proposal as Record<string, unknown>)?.id ?? null,
      country: cc, current, proposed: draft,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
