// premium-adfree.ts — premium members skip ALL ads (between-survey + in-app) for the day by watching ONE
// extra full-screen ad each day: the "9th minute", a 60-second SPONSORED ad. Advertisers OPT IN to sponsor
// this placement as part of their offer (AdGridAd.adfree_minute === true), and the advertiser pays for that
// premium impression — that is the platform's revenue. Selecting/watching it opts the member in automatically;
// they keep all their survey earnings. The benefit is EARNED DAILY: it applies only on days the member has
// watched that day's extra ad, and it resets every UTC day.
//
// Storage: one PremiumAdFreeDay row per member per UTC day, id = adf_<user>_<YYYY-MM-DD> (deterministic, so
// marking "done" is single-flight). The opt-in itself is a flag on the User (premium_adfree_optin).
import { snapBool, snapNumber } from "./settings.ts";

export const adFreeEnabled = (): boolean => snapBool("PREMIUM_ADFREE_ENABLED", true);
// Length of the extra "ninth-minute" ad the member watches once a day to be ad-free (default 60s).
export const adFreeAdSeconds = (): number => Math.max(5, Math.round(snapNumber("PREMIUM_ADFREE_AD_SECONDS", 60)));
export const utcDay = (d: Date = new Date()): string => d.toISOString().slice(0, 10);
export const adFreeDayId = (userId: string, day: string = utcDay()): string => `adf_${userId}_${day}`;

// Has this member watched today's extra ad? (Ad-free applies only when true.)
// deno-lint-ignore no-explicit-any
export async function hasMetAdFreeToday(db: any, userId: string): Promise<boolean> {
  const row = await db.get("PremiumAdFreeDay", adFreeDayId(String(userId))).catch(() => null);
  return !!(row && row.met === true);
}

// Read today's status without mutating.
// deno-lint-ignore no-explicit-any
export async function adFreeStatusToday(db: any, userId: string): Promise<{ met: boolean; ad_seconds: number; ad_id: string | null; fee_charged: boolean }> {
  const row = await db.get("PremiumAdFreeDay", adFreeDayId(String(userId))).catch(() => null);
  return { met: !!(row && row.met === true), ad_seconds: adFreeAdSeconds(), ad_id: (row?.ad_id as string) ?? null, fee_charged: row?.fee_charged === true };
}

// Mark today's extra ad as watched → the member is ad-free for the rest of the day. Upsert on the
// deterministic per-day id so a double submit can't create two rows. Returns whether this call was the
// transition into "done" (so the caller books the billable impression / optional fee exactly once).
// deno-lint-ignore no-explicit-any
export async function markAdFreeAdWatched(db: any, userId: string, adId: string): Promise<{ met: boolean; just_met: boolean; fee_charged: boolean }> {
  const day = utcDay();
  const id = adFreeDayId(String(userId), day);
  let row = await db.get("PremiumAdFreeDay", id).catch(() => null);
  if (!row) {
    try { row = await db.create("PremiumAdFreeDay", { id, user_id: String(userId), day, met: false, fee_charged: false }); }
    catch { row = await db.get("PremiumAdFreeDay", id).catch(() => null); } // lost a create race → re-read
  }
  const prevMet = row?.met === true;
  if (!prevMet) {
    await db.update("PremiumAdFreeDay", id, { met: true, ad_id: String(adId || "house"), met_at: new Date().toISOString() }).catch(() => {});
  }
  return { met: true, just_met: !prevMet, fee_charged: row?.fee_charged === true };
}

// Mark today's optional points fee as booked (idempotency guard so it can't double-charge).
// deno-lint-ignore no-explicit-any
export async function markAdFreeFeeCharged(db: any, userId: string, feePoints: number): Promise<void> {
  await db.update("PremiumAdFreeDay", adFreeDayId(String(userId)), { fee_charged: true, fee_points: feePoints }).catch(() => {});
}

// Is this premium member ENROLLED in the ninth-minute ad-free option? Premium members are enrolled BY
// DEFAULT; enrollment ends only when they explicitly opt out (premium_adfree_optout === true).
// deno-lint-ignore no-explicit-any
export function adFreeEnrolled(user: any): boolean {
  return !!user && user.premium_adfree_optout !== true;
}

// Should this member be ad-free RIGHT NOW? Feature on + premium + enrolled (not opted out) + watched today's
// extra ad.
// deno-lint-ignore no-explicit-any
export async function premiumAdFreeActive(db: any, user: any, premium: boolean): Promise<boolean> {
  if (!adFreeEnabled() || !premium) return false;
  if (!adFreeEnrolled(user)) return false;
  return await hasMetAdFreeToday(db, String(user.id));
}
