import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { earningsWhatIfConfig, userWhatIf } from "../../sdk/earnings-whatif.ts";

// earningsWhatIf (auth) — compute the caller's OWN what-if scenario from their history + their inputs.
// Makes no platform claim; every result carries the "not a prediction/promise" disclaimer.
//   Body: { target_usd?, minutes_per_day?, days? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const u = user as Record<string, unknown>;
    const cfg = await earningsWhatIfConfig(u.jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const isPremium = Boolean(u.is_premium || u.premium || u.premium_active);
    const body = await req.json().catch(() => ({}));
    const result = await userWhatIf(String(user.id), isPremium, {
      target_usd: body.target_usd, minutes_per_day: body.minutes_per_day, days: body.days,
    }, u.jurisdiction as string | null ?? null);
    return Response.json({ enabled: true, result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
