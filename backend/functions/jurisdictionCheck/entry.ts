import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { cashOutAllowed, featureAllowed, minAgeFor, prizeNeedsRegistration, ruleFor } from "../../sdk/jurisdiction.ts";

// jurisdictionCheck (Master Plan 0.2) — resolve what's allowed for a state/country (e.g. "US-CA").
//   body: { jurisdiction?, feature?, prize_value? }  (falls back to the user's stored jurisdiction/state)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const jurisdiction = body.jurisdiction ?? user.jurisdiction ?? user.state ?? null;
    const feature = body.feature ? String(body.feature) : null;
    const prizeValue = Number(body.prize_value ?? 0);

    return Response.json({
      jurisdiction,
      rule: ruleFor(jurisdiction),
      min_age: minAgeFor(jurisdiction),
      cash_out_allowed: cashOutAllowed(jurisdiction),
      feature_allowed: feature ? featureAllowed(feature, jurisdiction) : null,
      prize_needs_registration: prizeValue > 0 ? prizeNeedsRegistration(prizeValue, jurisdiction) : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
