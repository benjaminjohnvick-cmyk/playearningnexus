// Advertiser-as-survey-taker — shared config + helpers.
//
// A PPC advertiser may OPTIONALLY choose, at signup, to also participate as a survey-taker. When they
// opt in, the surveys they fill out come from the THIRD-PARTY survey providers only (BitLabs, CPX,
// AdGate, Respondent, …) — never the platform's own PPC surveys. Keeping an advertiser's own survey
// activity on independent, third-party inventory avoids any conflict of interest with their campaigns
// and keeps their responses at arm's length from what they're paying to advertise.
//
// This is an OPT-IN. It is presented as a choice on PPC advertiser signup; the advertiser is never
// enrolled as a survey participant without ticking it and accepting the consent line. Nothing here
// promises earnings — survey availability and reward are variable, exactly as for any other user.

import { snapBool, snapString } from "./settings.ts";
import { recordConsent } from "./consent-ledger.ts";
import { db } from "./db.ts";

/** Is the survey-taker opt-in offered on PPC advertiser signup? */
export const advertiserSurveyOptInEnabled = () => snapBool("PPC_ADVERTISER_SURVEY_OPTIN_ENABLED", true);

/** Which survey source an opted-in advertiser fills out ("third_party" = external providers only). */
export const advertiserSurveyProvider = () => snapString("PPC_ADVERTISER_SURVEY_PROVIDER", "third_party") || "third_party";

/** Does this advertiser fill out surveys from the third-party providers (vs. the platform's own)? */
export const advertiserUsesThirdPartySurveys = () => advertiserSurveyProvider() === "third_party";

/** The version string stamped on the advertiser-survey consent record. */
export const ADVERTISER_SURVEY_CONSENT_VERSION = "advertiser-surveys-1";

/**
 * Record a PPC advertiser opting IN to also take surveys. Sets user flags and appends an append-only
 * consent record. Idempotent-ish: writing the flags again is harmless. Best-effort; never throws.
 *   - `ppc_advertiser_survey_optin`   : true
 *   - `ppc_advertiser_survey_provider`: the configured source (e.g. "third_party")
 *   - `ppc_advertiser_survey_optin_at`: ISO timestamp
 * Returns the flags written, or null if the opt-in feature is disabled / not accepted.
 */
export async function recordAdvertiserSurveyOptIn(
  userId: string,
  opts?: { accepted?: boolean; termsVersion?: string | null; ip?: string | null },
): Promise<{ opted_in: true; provider: string; at: string } | null> {
  if (!userId) return null;
  if (!advertiserSurveyOptInEnabled()) return null;
  if (opts?.accepted === false) return null;
  const provider = advertiserSurveyProvider();
  const at = new Date().toISOString();

  await db.update("User", userId, {
    ppc_advertiser_survey_optin: true,
    ppc_advertiser_survey_provider: provider,
    ppc_advertiser_survey_optin_at: at,
  }).catch(() => null);

  await recordConsent({
    user_id: userId,
    kind: "advertiser_survey_optin",
    version: opts?.termsVersion ?? ADVERTISER_SURVEY_CONSENT_VERSION,
    accepted: true,
    shown: {
      provider,
      note: "Optional: advertiser also participates as a survey-taker using third-party survey providers. Survey availability and reward are variable and not guaranteed.",
    },
    ip: opts?.ip ?? null,
  }).catch(() => null);

  return { opted_in: true, provider, at };
}

/** Has this advertiser opted in to also take (third-party) surveys? */
export async function isAdvertiserSurveyOptedIn(userId: string): Promise<boolean> {
  if (!userId) return false;
  const u = await db.get("User", userId).catch(() => null) as Record<string, unknown> | null;
  return !!(u && u.ppc_advertiser_survey_optin === true);
}
