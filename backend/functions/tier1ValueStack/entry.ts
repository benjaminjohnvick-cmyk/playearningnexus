import { __handler } from "../../sdk/runtime.ts";
import { tier1ValueStack, tier1ValueStackEnabled } from "../../sdk/tier1-value-stack.ts";

// tier1ValueStack (read-only, public-facing) — the itemized "$12,000 → $24,000 in advertising value" stack for
// the Tier 1 / founding offer: each included deliverable at its conventional market value, the total delivered
// advertising value, and the multiple over price. Impression lines are backed by the delivery guarantee.
// This is advertising value DELIVERED — never a promise about the advertiser's revenue or ROI.
export default __handler(async (_req) => {
  try {
    if (!tier1ValueStackEnabled()) return Response.json({ enabled: false });
    const stack = tier1ValueStack();
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
