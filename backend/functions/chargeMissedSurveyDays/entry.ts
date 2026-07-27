import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// chargeMissedSurveyDays — DISABLED under the no-penalty model.
//
// Missed days are NEVER charged. A missed day simply doesn't earn — there is no debt and nothing to
// collect. This endpoint no longer creates any Stripe charge or negative transaction; it exists only
// so any old caller receives a clear, harmless response instead of triggering a charge.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    return Response.json({
      success: true,
      charged: false,
      amount: 0,
      model: "no-penalty-points",
      message: "Missed days are not charged. Users earn points as they go; a day not worked simply " +
        "doesn't earn. Nothing is owed or collected.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
