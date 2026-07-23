// Closed-loop payout policy.
//
// The platform is **closed-loop for USERS**: their earnings stay as on-site credit
// (redeemable for perks via redeemRewardPerk) and are never paid out as cash. Only business
// PARTNERS — developers, survey creators, advertisers, affiliates — receive real cash (their
// revenue share) via PayPal/CashApp/Venmo. This is enforced at the money rails, so no code
// path can cash out a regular user regardless of which function initiates it.
//
// Tune who counts as a partner in payout-policy.json — no code change.
type Policy = { partnerRoles: string[]; partnerPayoutTypes: string[] };
const policy: Policy = JSON.parse(
  await Deno.readTextFile(new URL("./payout-policy.json", import.meta.url)),
);
const roles = new Set(policy.partnerRoles.map((r) => r.toLowerCase()));
const types = new Set(policy.partnerPayoutTypes.map((t) => t.toLowerCase()));

/** True only for business-partner payouts (which may go out as cash). Everything else is a
 *  user earning and must stay as on-site credit. */
export function isPartnerPayout(input: { role?: string | null; payout_type?: string | null }): boolean {
  const role = (input.role ?? "").toLowerCase();
  const type = (input.payout_type ?? "").toLowerCase();
  return roles.has(role) || types.has(type);
}

// --- Business vs regular account (single source of truth) ----------------------
// A "business account" is any partner-capacity role (developer, survey creator, advertiser,
// affiliate, business, admin). This is used in BOTH places the distinction matters:
//   • payouts — business accounts can receive cash (isPartnerPayout);
//   • store orders — business accounts pay NO markup; regular users pay the 10% markup.
// Keeping one definition means "business capacity" means the same thing everywhere.
export const PARTNER_ROLES = roles;

export function isBusinessAccount(role?: string | null): boolean {
  return roles.has((role ?? "").toLowerCase());
}

/** The 10% store markup for regular users; business accounts are exempt. */
export const STORE_MARKUP = 0.10;
export function applyMarkup(rawPrice: number, role?: string | null): number {
  const price = isBusinessAccount(role) ? rawPrice : rawPrice * (1 + STORE_MARKUP);
  return Math.round(price * 100) / 100;
}
