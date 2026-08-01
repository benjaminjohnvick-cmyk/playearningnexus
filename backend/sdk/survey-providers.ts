// survey-providers.ts — the multi-provider survey supply registry.
//
// Supply is the real constraint on earnings. To handle Swagbucks-scale demand (millions of users) you need
// MANY redundant survey networks so there's always inventory; the router serves whichever enabled networks
// have matching surveys. You START with BitLabs only (the rest ship OFF, keyed on when you sign each one),
// so launch is simple and you scale supply by flipping providers on as you onboard them.

import { snapBool, snapString } from "./settings.ts";

export interface Provider {
  key: string;
  label: string;
  enabled: boolean;
  kind: "offerwall" | "api";
}

// The known networks. BitLabs is ON at launch; every other provider is OFF until you enable it (and add its
// key). Add as many as you like here — the router just uses the enabled+configured ones.
const REGISTRY: { key: string; label: string; kind: "offerwall" | "api"; defaultOn: boolean }[] = [
  { key: "bitlabs",      label: "BitLabs",        kind: "offerwall", defaultOn: true },   // launch network
  { key: "cpx",          label: "CPX Research",   kind: "offerwall", defaultOn: false },
  { key: "theoremreach", label: "TheoremReach",   kind: "offerwall", defaultOn: false },
  { key: "pollfish",     label: "Pollfish",       kind: "api",       defaultOn: false },
  { key: "inbrain",      label: "InBrain.ai",     kind: "offerwall", defaultOn: false },
  { key: "tapresearch",  label: "TapResearch",    kind: "offerwall", defaultOn: false },
  { key: "cint",         label: "Cint (Lucid)",   kind: "api",       defaultOn: false },
  { key: "adgate",       label: "AdGate Media",   kind: "offerwall", defaultOn: false },
  { key: "ayet",         label: "ayeT-Studios",   kind: "offerwall", defaultOn: false },
  { key: "revlum",       label: "Revlum",         kind: "offerwall", defaultOn: false },
  { key: "prodege",      label: "Prodege (MySoapbox)", kind: "api",  defaultOn: false },
];

const flagKey = (k: string) => `PROVIDER_${k.toUpperCase()}_ENABLED`;
const secretKey = (k: string) => `${k.toUpperCase()}_API_KEY`;

/** All known networks + whether each is switched on (admin-tunable). */
export function surveyProviders(): Provider[] {
  return REGISTRY.map((p) => ({ key: p.key, label: p.label, kind: p.kind, enabled: snapBool(flagKey(p.key), p.defaultOn) }));
}

export function enabledProviders(): Provider[] {
  return surveyProviders().filter((p) => p.enabled);
}

/** True when the provider's credentials are present. Each network's key lives in env/DB, never in a URL. */
export function providerConfigured(key: string): boolean {
  const k = String(key || "").toLowerCase();
  if (k === "bitlabs") return !!snapString("BITLABS_API_TOKEN", "") || !!snapString("BITLABS_APP_TOKEN", "") || !!snapString("BITLABS_API_KEY", "");
  if (k === "cpx") return !!snapString("CPX_APP_ID", "") && !!snapString("CPX_SECRET", "");
  if (k === "theoremreach") return !!snapString("THEOREMREACH_API_KEY", "");
  // Generic: a <PROVIDER>_API_KEY present means configured.
  return !!snapString(secretKey(k), "");
}

/** Networks that are BOTH enabled and configured — what the router can actually serve right now. */
export function readyProviders(): Provider[] {
  return enabledProviders().filter((p) => providerConfigured(p.key));
}

/** Build a CPX offerwall URL for a user (secure hash computed by the caller; never puts secrets in a logged URL). */
export function cpxOfferwallUrl(appId: string, extUserId: string, secureHash: string): string {
  const u = new URL("https://offers.cpx-research.com/index.php");
  u.searchParams.set("app_id", appId);
  u.searchParams.set("ext_user_id", extUserId);
  if (secureHash) u.searchParams.set("secure_hash", secureHash);
  return u.toString();
}
