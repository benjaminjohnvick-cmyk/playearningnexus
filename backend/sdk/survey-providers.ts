// survey-providers.ts — the multi-provider survey supply registry.
//
// Supply is the real constraint on non-premium earnings ("no surveys available" is why people stop). Adding
// networks alongside BitLabs — CPX Research, TheoremReach, etc. — increases the surveys available per day.
// Each provider is a thin adapter: an offerwall/entry URL + a postback endpoint that credits the user
// through the same reward path (computeSurveyReward), so every network shares one payout rule.

import { snapBool, snapString } from "./settings.ts";

export interface Provider {
  key: string;
  label: string;
  enabled: boolean;
  kind: "offerwall" | "api";
}

/** The known providers and whether each is switched on (admin-tunable). BitLabs stays the default network. */
export function surveyProviders(): Provider[] {
  return [
    { key: "bitlabs", label: "BitLabs", enabled: snapBool("PROVIDER_BITLABS_ENABLED", true), kind: "offerwall" },
    { key: "cpx", label: "CPX Research", enabled: snapBool("PROVIDER_CPX_ENABLED", false), kind: "offerwall" },
    { key: "theoremreach", label: "TheoremReach", enabled: snapBool("PROVIDER_THEOREMREACH_ENABLED", false), kind: "offerwall" },
  ];
}

export function enabledProviders(): Provider[] {
  return surveyProviders().filter((p) => p.enabled);
}

export function providerConfigured(key: string): boolean {
  if (key === "cpx") return !!snapString("CPX_APP_ID", "") && !!snapString("CPX_SECRET", "");
  if (key === "theoremreach") return !!snapString("THEOREMREACH_API_KEY", "");
  if (key === "bitlabs") return !!snapString("BITLABS_API_TOKEN", "") || !!snapString("BITLABS_APP_TOKEN", "");
  return false;
}

/** Build a CPX offerwall URL for a user (secure hash left to the caller/env; never puts secrets in the URL log). */
export function cpxOfferwallUrl(appId: string, extUserId: string, secureHash: string): string {
  const u = new URL("https://offers.cpx-research.com/index.php");
  u.searchParams.set("app_id", appId);
  u.searchParams.set("ext_user_id", extUserId);
  if (secureHash) u.searchParams.set("secure_hash", secureHash);
  return u.toString();
}
