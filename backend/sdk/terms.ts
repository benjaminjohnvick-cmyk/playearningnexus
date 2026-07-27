// Terms versioning + forced re-consent (Master Plan 0.5).
//
// Bump CURRENT_TERMS_VERSION whenever the ToS / Privacy Policy changes; users must re-accept before
// continuing. This lets your lawyer change policy language and have it take LEGAL effect with zero
// engineering — the version string is the only thing that changes. Acceptance is written to the
// immutable consent ledger (kind = "terms").
import { hasConsented, recordConsent } from "./consent-ledger.ts";
import { snapString } from "./settings.ts";

// Bump this string when the terms change. Config, not logic. (Env override: TERMS_VERSION.)
export const CURRENT_TERMS_VERSION = Deno.env.get("TERMS_VERSION") ?? "2026-07-01";
/** Live, admin-adjustable terms version (DB override → env → default). */
export function currentTermsVersion(): string { return snapString("TERMS_VERSION", CURRENT_TERMS_VERSION); }

/** Does this user still need to accept the current terms version? */
export async function needsReconsent(userId: string): Promise<boolean> {
  return !(await hasConsented(userId, "terms", currentTermsVersion()));
}

/** Record acceptance of the current terms version. */
export async function acceptCurrentTerms(userId: string, ip?: string | null, shown?: unknown) {
  return await recordConsent({
    user_id: userId, kind: "terms", version: currentTermsVersion(), accepted: true, ip, shown,
  });
}
