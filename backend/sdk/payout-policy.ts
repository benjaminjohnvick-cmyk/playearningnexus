// Closed-loop payout policy.
//
// The platform is **closed-loop for USERS**: their earnings stay as on-site credit
// (redeemable for perks via redeemRewardPerk) and are never paid out as cash. Only business
// PARTNERS — developers, survey creators, advertisers, affiliates — receive real cash (their
// revenue share) via PayPal/CashApp/Venmo. This is enforced at the money rails, so no code
// path can cash out a regular user regardless of which function initiates it.
//
// Tune who counts as a partner in payout-policy.json — no code change.
import { db } from "./db.ts";
import { isEnabled } from "./feature-flags.ts";
import { getBool } from "./settings.ts";
import { solvency } from "./treasury.ts";

type Policy = { partnerRoles: string[]; partnerPayoutTypes: string[] };
const policy: Policy = JSON.parse(
  await Deno.readTextFile(new URL("./payout-policy.json", import.meta.url)),
);
const roles = new Set(policy.partnerRoles.map((r) => r.toLowerCase()));
const types = new Set(policy.partnerPayoutTypes.map((t) => t.toLowerCase()));

/** True only for business-partner payouts (which may go out as cash). Everything else is a
 *  user earning and must stay as on-site credit.
 *
 *  SECURITY: `payout_type` can be client-supplied on the direct user-facing rails, and a partner
 *  payout_type would otherwise let a regular user slip past the wall. So the type-based path is only
 *  honored when the CALLER trusts the type (server-initiated flows that set payout_type themselves).
 *  Pass `{ trustType: false }` from any rail where payout_type comes from the request body — then a
 *  server-verified PARTNER ROLE is required for cash. This matters most when cash_out is ON, where this
 *  function is the sole wall between a user and cash. */
export function isPartnerPayout(
  input: { role?: string | null; payout_type?: string | null },
  opts: { trustType?: boolean } = {},
): boolean {
  const role = (input.role ?? "").toLowerCase();
  const type = (input.payout_type ?? "").toLowerCase();
  if (roles.has(role)) return true;                       // server-verified partner role — always ok
  if (opts.trustType !== false && types.has(type)) return true; // trusted server-set payout_type
  return false;                                           // client-supplied type alone can't grant cash
}

/** Resolve, from a user id, whether that account is a cash-eligible business PARTNER.
 *  Loads the user and checks their server-side role — a client can't spoof this. Non-partners
 *  (regular users) are closed-loop: their earnings stay as on-site store credit and are never
 *  cashed out. Automations that iterate over payout/withdrawal records MUST call this before
 *  approving, completing, or sending, so no legacy or scheduled path can pay a regular user. */
export async function isPartnerUserId(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const u = await db.get("User", String(userId));
    return isBusinessAccount((u as Record<string, unknown> | null)?.role as string | undefined);
  } catch {
    return false; // fail closed — if we can't verify a partner, treat as a regular user (no cash)
  }
}

/** Two independent brakes on real cash leaving the platform, checked together at every money rail:
 *   1. `cash_out` — the operational kill-switch (emergency stop for ALL disbursement).
 *   2. `CASH_OUT_LEGAL_SIGNOFF` — a legal hold. Default TRUE so partner revenue-share payouts run from
 *      launch (paying your own affiliates/developers/advertisers is a vendor payment, not user money
 *      transmission — the user wall is enforced separately by isPartnerPayout). Flip it FALSE to place a
 *      one-switch legal hold on cash disbursement (e.g. pending a counsel review of state MTL posture)
 *      without touching the operational kill-switch. Returns a reason when blocked, else null. */
export async function cashDisbursementHold(jurisdiction?: string | null): Promise<string | null> {
  if (!(await isEnabled("cash_out", jurisdiction ?? null))) return "cash payouts are disabled (cash_out kill-switch).";
  if (!(await getBool("CASH_OUT_LEGAL_SIGNOFF", true))) return "cash payouts are on legal hold pending counsel sign-off (CASH_OUT_LEGAL_SIGNOFF).";
  // 3. Solvency brake — if the business account can't currently cover its obligations (the reserve), pause ALL
  //    payouts so expenses always stay covered. Gated by PAYOUT_SOLVENCY_GUARD (default on); fail-safe — a read
  //    error never blocks a legitimate payout (the two brakes above remain the primary controls).
  try {
    if (await getBool("PAYOUT_SOLVENCY_GUARD", true)) {
      const s = await solvency();
      if (!s.solvent) return `cash payouts paused: the business account is $${s.shortfall_usd.toLocaleString()} short of covering its obligations (solvency guard). Top up the account or adjust the reserve before paying out.`;
    }
  } catch { /* fail-safe: never block a payout on a solvency read error */ }
  return null;
}

/** A ready-made "closed-loop" block payload for automations to record/return when they skip a
 *  non-partner payout, so the reason is uniform and auditable across every rail. */
export const CLOSED_LOOP_BLOCK = {
  blocked: true,
  closed_loop: true,
  cash_sent: false,
  message: "Closed-loop platform: user earnings remain as on-site store credit and are not paid out as cash. Only business-partner revenue shares are paid in cash.",
} as const;

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
