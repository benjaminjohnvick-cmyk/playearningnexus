import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";

// promoValue (PUBLIC, no auth) — the advertised promotional figures for the landing/signup hero and
// marketing, from a single source of truth (settings). Keep the displayed number truthful with "up to"
// + disclosure (see WELCOME-REWARDS-AND-VALUE-STACK.md).
export default __handler(async (_req) => {
  try {
    return Response.json({
      advertised_value_usd: await getNumber("ADVERTISED_VALUE_TOTAL", 2000),
      welcome_rewards_usd: await getNumber("WELCOME_REWARDS_TOTAL", 1460),
      welcome_max_pct: await getNumber("WELCOME_REWARDS_MAX_PCT", 0.20),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
