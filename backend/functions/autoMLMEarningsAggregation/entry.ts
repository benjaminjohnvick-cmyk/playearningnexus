import { __handler } from "../../sdk/runtime.ts";

// DEPRECATED under the AFFILIATE model. Downline earnings aggregation is a multi-level concept that
// no longer applies — affiliates earn a single one-time flat bounty per active referral (see
// distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer does anything.
export default __handler(async (_req) => {
  return Response.json({ ok: true, skipped: true, reason: "downline aggregation removed — affiliate model is single-tier" });
});
