import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { computeLoyaltySavings } from "../../sdk/loyalty.ts";

// loyaltySavings (authenticated) — a FACTUAL "here's what you've saved" tracker: value already earned
// from surveys + points-back, net of any markup paid, plus a real-dollar figure and a "% saved" number.
// It hands out nothing; it's a mirror of realized activity. Gated behind the purchase_payback admin
// toggle. Backward-looking only (never a future-earnings projection). Body: {}
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("purchase_payback"))) {
      return Response.json({ enabled: false, message: "The savings tracker isn't turned on." }, { status: 200 });
    }

    const savings = await computeLoyaltySavings(user.id);
    return Response.json({ enabled: true, savings });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
