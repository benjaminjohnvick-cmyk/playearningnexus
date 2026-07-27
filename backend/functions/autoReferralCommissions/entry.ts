import { __handler } from "../../sdk/runtime.ts";

// DEPRECATED under the AFFILIATE model. Ongoing per-earning referral commissions are replaced by a
// single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts).
// This endpoint no longer pays anything.
export default __handler(async (_req) => {
  return Response.json({ ok: true, skipped: true, reason: "ongoing commissions disabled — affiliate model pays one-time bounties" });
});
