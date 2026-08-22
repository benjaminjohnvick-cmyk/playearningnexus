// social-amplification.test.ts — the pure core of user-amplified social advertising.
//   deno test backend/sdk/social-amplification.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  userSocialReach, estimatedSocialImpressions, socialImpressionsValueUsd, socialPostContribution,
  socialAmpEnabledForTier, normalizeTier,
} from "./social-amplification.ts";

Deno.test("userSocialReach: sums active connections, ignores inactive, caps", () => {
  const conns = [
    { platform: "instagram", follower_count: 8000, is_active: true },
    { platform: "x", followers: 2000, is_active: true },
    { platform: "tiktok", follower_count: 100000, is_active: false }, // inactive → ignored
  ];
  assertEquals(userSocialReach(conns), 10000);
  // cap applies (default max 50,000)
  assertEquals(userSocialReach([{ follower_count: 90000, is_active: true }]), 50000);
  assertEquals(userSocialReach([]), 0);
});

Deno.test("estimatedSocialImpressions: reach × view rate (0.30 default)", () => {
  assertEquals(estimatedSocialImpressions(10000), 3000);
  assertEquals(estimatedSocialImpressions(10000, 0.5), 5000);
  assertEquals(estimatedSocialImpressions(0), 0);
});

Deno.test("social value: impressions convert at the FVG CPM ($22)", () => {
  // 3000 impressions / 1000 × $22 = $66
  assertEquals(socialImpressionsValueUsd(3000), 66);
});

Deno.test("socialPostContribution: reach → capped → est impressions → $ value", () => {
  const c = socialPostContribution(10000);
  assertEquals(c.reach, 10000);
  assertEquals(c.est_impressions, 3000);
  assertEquals(c.value_usd, 66);
  // reach above the cap is clamped before valuing
  const big = socialPostContribution(200000);
  assertEquals(big.reach, 50000);
  assertEquals(big.est_impressions, 15000);
  assertEquals(big.value_usd, 330);
});

Deno.test("all three tiers are amplified by default; tier normalization", () => {
  assertEquals(socialAmpEnabledForTier("tier1"), true);
  assertEquals(socialAmpEnabledForTier("tier2"), true);
  assertEquals(socialAmpEnabledForTier("tier3"), true);
  assertEquals(normalizeTier("tier3"), "tier3");
  assertEquals(normalizeTier("weird"), "tier1");
});
