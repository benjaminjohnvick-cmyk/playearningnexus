import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { saveKyc } from "../../sdk/kyc.ts";
import { emitEvent } from "../../sdk/events.ts";

// kycSurveySubmit (authenticated) — save the user's KYC answers, grant the one-time non-cashable
// reward (tops up the welcome-rewards pool; per-order cap + expiry apply), and emit a domain event so
// the personalization + self-learning layers pick up the new interest signals. Idempotent: submitting
// again updates answers but never re-grants the reward.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const answers = body?.answers ?? body;

    const result = await saveKyc(user.id, answers);
    if (!result.ok) return Response.json({ error: "Could not save KYC survey" }, { status: 400 });

    // Best-effort: refresh the user's AI profile and fan out the interest signal.
    base44.asServiceRole.functions.invoke("buildUserAIProfiles", { user_id: user.id }).catch(() => {});
    emitEvent("kyc.completed", { user_id: user.id, first_time: result.first_time }, { source: "kycSurveySubmit" }).catch(() => {});

    return Response.json({
      success: true,
      reward_granted_usd: result.reward_granted,
      first_time: result.first_time,
      message: result.reward_granted > 0
        ? `Thanks! $${result.reward_granted} in welcome rewards added — your catalog is now personalized.`
        : "Thanks! Your preferences are saved and your catalog is personalized.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
