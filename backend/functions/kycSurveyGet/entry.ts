import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getActiveSurvey, kycStatus } from "../../sdk/kyc.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";

// kycSurveyGet (authenticated) — returns the Know-Your-Customer survey plus this user's status:
// whether they still MUST complete it (mandatory first survey) and the non-cashable reward on offer.
// The frontend gate uses `required` to block the app until the survey is submitted.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const flagOn = await isEnabled("kyc_survey").catch(() => true);
    const [status, survey] = await Promise.all([kycStatus(user.id), getActiveSurvey()]);

    return Response.json({
      survey,
      completed: status.completed,
      required: flagOn && status.required,
      reward_usd: status.reward_usd,
      answers: status.answers,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
