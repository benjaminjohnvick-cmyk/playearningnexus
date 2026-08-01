import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { SCREENING_KEYS, profileCompleteness } from "../../sdk/survey-profile.ts";

// getSurveyProfile (authenticated) — the user's CYK master profile (screening answers only) + how complete
// it is. Used to render the profile form and to feed the provider profiler. Read-only.
//   Body: {}  → { answers, completeness, screening_keys }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("SurveyProfile", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const answers = (rows && rows[0] ? rows[0].answers : {}) as Record<string, string> || {};

    return Response.json({
      answers,
      completeness: profileCompleteness(answers),
      screening_keys: SCREENING_KEYS,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
