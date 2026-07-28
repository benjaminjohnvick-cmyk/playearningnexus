import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { ensureWelcomeCredit } from "../../sdk/welcome-credit.ts";
import { getNumber } from "../../sdk/settings.ts";

// welcomeCreditStatus (authenticated) — the buyer's welcome-rewards balance + the advertised value
// figure, for banners and onboarding. Lazily grants the pool on first call.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const c = await ensureWelcomeCredit(user.id);
    return Response.json({
      success: true,
      remaining_usd: c.remaining_usd,
      expires_at: c.expires_at,
      expired: c.expired,
      total_usd: await getNumber("WELCOME_REWARDS_TOTAL", 1460),
      max_pct: await getNumber("WELCOME_REWARDS_MAX_PCT", 0.20),
      advertised_value_usd: await getNumber("ADVERTISED_VALUE_TOTAL", 1700),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
