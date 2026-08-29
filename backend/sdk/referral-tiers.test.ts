// referral-tiers.test.ts — the pure two-tier referral bonus core.
//   deno test backend/sdk/referral-tiers.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { referralBonusAmount, advertiserBonusEligible, userBonusEligible } from "./referral-tiers.ts";

const DAY = 86400000;
const NOW = Date.parse("2026-09-01T00:00:00Z");

Deno.test("amounts: user $5 default, advertiser $2000 default across tiers", () => {
  assertEquals(referralBonusAmount("user"), 5);
  assertEquals(referralBonusAmount("advertiser"), 2000);
  assertEquals(referralBonusAmount("advertiser", "tier1"), 2000);
  assertEquals(referralBonusAmount("advertiser", "tier2"), 2000);
  assertEquals(referralBonusAmount("advertiser", "tier3"), 2000);
});

Deno.test("advertiser bonus: pays only after payment clears + clawback elapsed", () => {
  // cleared 60 days ago, 45-day clawback → eligible
  const ok = advertiserBonusEligible({ payment_cleared_at: new Date(NOW - 60 * DAY).toISOString(), kyc_ok: true, nowMs: NOW, clawbackDays: 45 });
  assertEquals(ok.eligible, true);

  // cleared 10 days ago → still in clawback window
  const soon = advertiserBonusEligible({ payment_cleared_at: new Date(NOW - 10 * DAY).toISOString(), kyc_ok: true, nowMs: NOW, clawbackDays: 45 });
  assertEquals(soon.eligible, false);
  assert(soon.reason.includes("clawback"));
  assertEquals(soon.clawback_days_left, 35);

  // not cleared at all
  assertEquals(advertiserBonusEligible({ payment_cleared_at: null, kyc_ok: true, nowMs: NOW }).eligible, false);
});

Deno.test("advertiser bonus: refund, self-referral, no-KYC, already-paid all block it", () => {
  const base = { payment_cleared_at: new Date(NOW - 90 * DAY).toISOString(), kyc_ok: true, nowMs: NOW, clawbackDays: 45 };
  assertEquals(advertiserBonusEligible({ ...base, refunded: true }).eligible, false);
  assertEquals(advertiserBonusEligible({ ...base, chargeback: true }).eligible, false);
  assertEquals(advertiserBonusEligible({ ...base, self_referral: true }).eligible, false);
  assertEquals(advertiserBonusEligible({ ...base, kyc_ok: false }).eligible, false);
  assertEquals(advertiserBonusEligible({ ...base, already_paid: true }).eligible, false);
  assertEquals(advertiserBonusEligible(base).eligible, true);   // control
});

Deno.test("user bonus: active gates it; self-referral + already-paid block", () => {
  assertEquals(userBonusEligible({ active: true }).eligible, true);
  assertEquals(userBonusEligible({ active: false }).eligible, false);
  assertEquals(userBonusEligible({ active: true, self_referral: true }).eligible, false);
  assertEquals(userBonusEligible({ active: true, already_paid: true }).eligible, false);
});
