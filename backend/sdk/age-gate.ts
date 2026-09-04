// age-gate.ts — the shared 18+ gate for value-realization paths (redeem / cash-out). The platform is 18+ and
// the age gate is enforced at signup, but a user who signed up via a federated path (e.g. Google) can carry
// `needs_age_verification: true` until they complete /auth/verifyAge. Such a user must not be able to REALIZE
// value (redeem perks, withdraw) before verifying. This guard is the reusable check for those chokepoints.
// Pure + synchronous — reads only fields already on the user record.
import { ageStatus } from "./household.ts";

// deno-lint-ignore no-explicit-any
type U = Record<string, any> | null | undefined;

/** null when the user is a verified adult and may proceed; otherwise a human reason to block. */
export function adultBlockReason(user: U): string | null {
  if (!user) return "Sign in to continue.";
  if (user.needs_age_verification === true) {
    return "Please verify you're 18 or older before redeeming or withdrawing. Complete age verification in your account settings.";
  }
  if (!ageStatus(user).adult) {
    return "This action is restricted to verified adults (18+). Complete age verification to continue.";
  }
  return null;
}

/** true when the user is a verified adult. */
export function isVerifiedAdult(user: U): boolean {
  return adultBlockReason(user) === null;
}
