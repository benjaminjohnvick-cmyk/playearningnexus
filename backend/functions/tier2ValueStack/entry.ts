import { __handler } from "../../sdk/runtime.ts";
import { tier2ValueStack, tier2ValueStackEnabled } from "../../sdk/tier2-value-stack.ts";

// tier2ValueStack (read-only, public-facing) — the "$200,000 → $400,000 in advertising value" stack for Tier 2
// "Scale": the full A–D rate card at conventional market rates, the total delivered advertising value, and the
// multiple over price. Impression lines are backed by the delivery guarantee. This is advertising value
// DELIVERED — never a promise about the advertiser's revenue or ROI.
export default __handler(async (_req) => {
  try {
    if (!tier2ValueStackEnabled()) return Response.json({ enabled: false });
    const stack = tier2ValueStack();
    return Response.json({
      enabled: true,
      ...stack,
      disclaimer: "These are advertising deliverables valued at conventional market rates — the value you " +
        "receive, backed by our delivery guarantee. It is not a promise of revenue, sales, or ROI.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
