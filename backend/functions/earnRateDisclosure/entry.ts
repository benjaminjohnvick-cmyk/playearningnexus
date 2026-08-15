import { __handler } from "../../sdk/runtime.ts";
import { marketplaceEquivHoldEnabled, marketplaceEquivHoldPct } from "../../sdk/marketplace-fee.ts";

// earnRateDisclosure (public read) — the earning-screen disclosure of the platform hold on GROSS survey
// revenue (the "marketplace-equivalent" line). The Terms say this percentage "will be shown on the
// earning screens"; this endpoint is that source of truth, read live from settings so it can't drift.
export default __handler(() => {
  try {
    const enabled = marketplaceEquivHoldEnabled();
    const pct = enabled ? marketplaceEquivHoldPct() : 0;
    const pctLabel = `${(pct * 100).toFixed(pct * 100 % 1 === 0 ? 0 : 1)}%`;
    return Response.json({
      marketplace_hold_enabled: enabled,
      marketplace_hold_pct: pct,
      marketplace_hold_pct_label: pctLabel,
      disclosure: enabled
        ? `Before your survey reward is calculated, the platform retains ${pctLabel} of the gross survey revenue as its platform line. The reward you see already reflects this — nothing is deducted from your balance afterward.`
        : "The platform currently retains no hold on gross survey revenue; your reward reflects the full applicable share.",
      not_legal_advice: true,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
