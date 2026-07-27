import { __handler } from "../../sdk/runtime.ts";

// DEPRECATED under the AFFILIATE model. Multi-tier per-survey commissions are replaced by a single
// one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This
// endpoint no longer pays anything.
export default __handler(async (_req) => {
  return Response.json({ ok: true, skipped: true, reason: "tiered commissions disabled — affiliate model pays one-time bounties" });
});
