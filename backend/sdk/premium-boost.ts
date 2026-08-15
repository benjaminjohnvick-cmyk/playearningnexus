// premium-boost.ts — advertiser-funded gift boost for PREMIUM members. An extension of the platform-funded
// gift/boost idea (gift-boost.ts), but the funding source is the PPC / Tier 1 advertisers' fees and the
// recipients are premium members.
//
// HOW THE MONEY FLOWS (and why it's compliant):
//   advertiser pays their $12,000 fee → a slice funds a member-boost POOL → a premium member claims up to
//   $2,000 of NON-CASHABLE store credit from the pool → the member chooses how much to use and on which items.
// Value flows advertiser/platform → member only (never user-to-user), stays closed-loop and non-cashable, is
// a promotional/loyalty benefit (not earnings, not credit, nothing owed). Funding is tracked as discrete
// advertiser contributions consumed 1:1 into member grants, so the platform can never grant more boost than
// advertisers have actually funded. See PREMIUM-GIFT-BOOST.md.
import { isEnabled } from "./feature-flags.ts";
import { getNumber, getBool } from "./settings.ts";
import { db } from "./db.ts";
import { adjustUserBalance } from "./balance.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const MEMBER_CREDIT_FIELD = "gift_boost_credit_usd"; // non-cashable, item-directed boost credit on User

export interface PremiumBoostConfig {
  enabled: boolean;
  maxUsd: number;             // PREMIUM_GIFT_BOOST_MAX_USD (2000) — cap per member
  perAdvertiserUsd: number;   // PREMIUM_BOOST_PER_ADVERTISER_USD (2000) — funded into the pool per advertiser
  requirePremium: boolean;    // only premium members may claim
}

export async function premiumBoostConfig(jurisdiction?: string | null): Promise<PremiumBoostConfig> {
  return {
    enabled: await isEnabled("premium_gift_boost", jurisdiction ?? null),
    maxUsd: Math.max(0, await getNumber("PREMIUM_GIFT_BOOST_MAX_USD", 2000)),
    perAdvertiserUsd: Math.max(0, await getNumber("PREMIUM_BOOST_PER_ADVERTISER_USD", 2000)),
    requirePremium: await getBool("PREMIUM_BOOST_REQUIRE_PREMIUM", true),
  };
}

export function isPremium(user: Record<string, unknown>): boolean {
  return Boolean(user.is_premium || user.premium_active || user.premium);
}

// Total unclaimed funding across all advertiser contributions.
export async function poolAvailableUsd(): Promise<number> {
  try {
    const rows = await db.filter("PremiumBoostFunding", {}, "created_date", 500) || [];
    return round2(rows.reduce((s, r) => s + Math.max(0, Number((r as Record<string, unknown>).remaining_usd) || 0), 0));
  } catch { return 0; }
}

// Consume `amountUsd` from the pool, oldest advertiser contributions first. Returns how much was actually
// consumed (may be less than requested if the pool is short). Records nothing on the member here.
export async function consumeFunding(amountUsd: number): Promise<{ consumed: number; funding_refs: string[] }> {
  let need = round2(amountUsd);
  const refs: string[] = [];
  if (need <= 0) return { consumed: 0, funding_refs: refs };
  const rows = await db.filter("PremiumBoostFunding", {}, "created_date", 500) || [];
  for (const r of rows) {
    if (need <= 0) break;
    const row = r as Record<string, unknown>;
    const rem = Math.max(0, Number(row.remaining_usd) || 0);
    if (rem <= 0) continue;
    const take = Math.min(rem, need);
    await db.update("PremiumBoostFunding", String(row.id), { remaining_usd: round2(rem - take) });
    refs.push(String(row.id));
    need = round2(need - take);
  }
  return { consumed: round2(amountUsd - need), funding_refs: refs };
}

// Integration helper: call this when a PPC / Tier 1 advertiser payment is recorded. Adds one funded
// contribution (PREMIUM_BOOST_PER_ADVERTISER_USD, capped by what they actually paid) to the member-boost
// pool. Safe no-op when the feature is off. Returns how much was funded.
export async function fundBoostPoolFromAdvertiser(advertiserId: string, amountPaidUsd?: number): Promise<{ funded_usd: number } | null> {
  const cfg = await premiumBoostConfig();
  if (!cfg.enabled || !advertiserId) return null;
  const paid = amountPaidUsd == null ? Infinity : Math.max(0, Number(amountPaidUsd));
  const amount = round2(Math.min(cfg.perAdvertiserUsd, paid));
  if (amount <= 0) return null;
  await db.create("PremiumBoostFunding", {
    advertiser_id: String(advertiserId), amount_usd: amount, remaining_usd: amount,
    source: "advertiser_fee", created_at: new Date().toISOString(),
  });
  return { funded_usd: amount };
}

// Admin/utility helper to grant a member boost credit directly (e.g. a manual/promotional grant), WITHOUT
// drawing the shared pool. NOTE: this is intentionally NOT used at Tier 1 sign-up — the boost is decoupled
// from any individual's payment (advertiser signups fund the shared pool via fundBoostPoolFromAdvertiser, and
// premium members claim from it). Capped at the per-member max and bounded by prior grants. Nothing owed.
export async function grantMemberBoost(memberId: string, amountUsd: number, source: string): Promise<{ granted_usd: number } | null> {
  const cfg = await premiumBoostConfig();
  if (!cfg.enabled || !memberId) return null;
  const grant = await memberGrant(memberId);
  const already = Math.max(0, Number(grant?.granted_usd) || 0);
  const room = Math.max(0, cfg.maxUsd - already);
  const give = round2(Math.min(Math.max(0, Number(amountUsd) || 0), room));
  if (give <= 0) return { granted_usd: 0 };
  await adjustUserBalance(memberId, give, { field: MEMBER_CREDIT_FIELD });
  const fields = {
    member_id: memberId, granted_usd: round2(already + give),
    used_usd: Math.max(0, Number(grant?.used_usd) || 0), source, updated_at: new Date().toISOString(),
  };
  if (grant?.id) await db.update("PremiumBoostGrant", String(grant.id), fields, memberId);
  else await db.create("PremiumBoostGrant", { ...fields, created_at: new Date().toISOString() }, memberId);
  return { granted_usd: give };
}

export async function memberGrant(memberId: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.filter("PremiumBoostGrant", { member_id: memberId }, "-created_date", 1);
    return (rows && rows[0]) || null;
  } catch { return null; }
}

export interface PremiumBoostStatus {
  eligible: boolean;
  reason: string;
  premium: boolean;
  max_usd: number;              // per-member cap
  granted_usd: number;          // total claimed by this member so far
  used_usd: number;             // spent on items
  available_credit_usd: number; // claimed-but-unspent boost credit (their gift_boost_credit_usd)
  claimable_now_usd: number;    // more they could claim (cap - granted, bounded by pool)
  pool_available_usd: number;
  amount_owed_usd: number;      // ALWAYS 0
}

export function premiumBoostStatus(user: Record<string, unknown>, grant: Record<string, unknown> | null, pool: number, cfg: PremiumBoostConfig): PremiumBoostStatus {
  const premium = isPremium(user);
  const granted = round2(Number(grant?.granted_usd) || 0);
  const used = round2(Number(grant?.used_usd) || 0);
  const credit = round2(Number(user[MEMBER_CREDIT_FIELD]) || 0);
  const capRoom = Math.max(0, round2(cfg.maxUsd - granted));
  const claimable = round2(Math.min(capRoom, pool));
  const eligible = cfg.enabled && (!cfg.requirePremium || premium) && claimable > 0;
  let reason = "";
  if (!cfg.enabled) reason = "The premium boost isn't available right now.";
  else if (cfg.requirePremium && !premium) reason = "The advertiser-funded boost is a premium-member benefit — upgrade to claim it.";
  else if (capRoom <= 0) reason = `You've already claimed your full $${cfg.maxUsd.toLocaleString()} boost.`;
  else if (pool <= 0) reason = "The advertiser boost pool is momentarily empty — check back as more advertisers fund it.";
  return {
    eligible, reason, premium, max_usd: cfg.maxUsd,
    granted_usd: granted, used_usd: used, available_credit_usd: credit,
    claimable_now_usd: claimable, pool_available_usd: round2(pool), amount_owed_usd: 0,
  };
}

export function premiumBoostDisclosures(cfg: PremiumBoostConfig): string[] {
  return [
    `A gift boost of up to $${cfg.maxUsd.toLocaleString()} in store credit for premium members, funded by our advertisers — not by you or any other user.`,
    "It's non-cashable store credit (closed-loop). You choose how much to claim and how much to apply to each item.",
    "Nothing is owed and nothing is locked — it's a gift, not a loan or an advance.",
    "It's a promotional benefit, not earnings, and no value moves between users — the funding comes from advertiser fees.",
    "Apply it to the items you want; whatever you don't use stays as your boost credit until you do.",
  ];
}
