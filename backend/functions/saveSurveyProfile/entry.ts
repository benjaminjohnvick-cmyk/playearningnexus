import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { sanitizeProfileAnswers, profileCompleteness } from "../../sdk/survey-profile.ts";

// saveSurveyProfile (authenticated) — save/update the user's "CYK" master profile: their stable
// demographic/screening answers. Input is SANITIZED to the finite screening whitelist — any non-screening
// (substantive) key is silently dropped, so this file can never hold survey content. Upserts one profile
// per user.
//   Body: { answers: { age_band, gender, zip, income_band, ... } }  → { success, completeness }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const answers = sanitizeProfileAnswers(body.answers || {});   // whitelist-only

    const existing = await db.filter("SurveyProfile", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const nowIso = new Date().toISOString();
    if (existing && existing[0]) {
      const merged = { ...(existing[0].answers as Record<string, string> || {}), ...answers };
      await db.update("SurveyProfile", existing[0].id as string, { answers: merged, updated_at: nowIso }).catch(() => null);
      return Response.json({ success: true, completeness: profileCompleteness(merged) });
    }
    await base44.asServiceRole.entities.SurveyProfile.create({ user_id: user.id, answers, updated_at: nowIso });
    return Response.json({ success: true, completeness: profileCompleteness(answers) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
