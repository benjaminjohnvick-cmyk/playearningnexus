import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  usageFeeEnabled, usageFeeDailyUsd, usageFeeCapUsd, usageFeeOffsetEnabled, usageFeePerSurveyUsd,
  surveysToOffset, usageFeeDisclosure,
} from "../../sdk/usage-fee.ts";

// usageFeeStatus — read-only view of the uniform daily usage fee for the signed-in user: today's fee, how much
// of the cap they've paid, how much cap remains, the one extra survey that offsets it, and the honest
// disclosure line. Moves nothing. Reports enabled=false while the fee is gated off (pending counsel).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const feeUsd = usageFeeDailyUsd();
    const capUsd = usageFeeCapUsd();
    const paidToDate = Math.max(0, Number((user as Record<string, unknown>).usage_fee_paid_usd) || 0);
    const offset = usageFeeOffsetEnabled() ? surveysToOffset(feeUsd, usageFeePerSurveyUsd()) : 0;

    return Response.json({
      ok: true,
      enabled: usageFeeEnabled(),
      daily_fee_usd: feeUsd,
      cap_usd: capUsd,
      paid_to_date_usd: Math.round(paidToDate * 100) / 100,
      cap_remaining_usd: Math.round(Math.max(0, capUsd - paidToDate) * 100) / 100,
      surveys_to_offset: offset,
      disclosure: usageFeeDisclosure(feeUsd, capUsd),
      note: usageFeeEnabled()
        ? "Deducted only from earned rewards — never a debt. Complete one extra survey to net your target."
        : "Usage fee is OFF (pending counsel) — nothing is charged.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
