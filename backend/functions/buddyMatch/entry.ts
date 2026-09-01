import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { buddyEnabled } from "../../sdk/buddy.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { bookingEnabled, premiumAvailable, withinStartWindow, kycAffinity, type MatchPreference } from "../../sdk/buddy-schedule.ts";

/** User ids this person has been paired with before (so a "new buddy" request can exclude them). */
async function priorBuddyIds(uid: string): Promise<Set<string>> {
  const out = new Set<string>();
  const asA = await db.filter("BuddyPair", { user_a: uid }, "-created_date", 100).catch(() => []) as Record<string, unknown>[];
  const asB = await db.filter("BuddyPair", { user_b: uid }, "-created_date", 100).catch(() => []) as Record<string, unknown>[];
  for (const p of [...(asA || []), ...(asB || [])]) {
    const other = p.user_a === uid ? p.user_b : p.user_a;
    if (other) out.add(String(other));
  }
  return out;
}

// buddyMatch (authenticated) — pair the user with an available buddy for accountability while earning. If
// they already have an active buddy, returns it. Otherwise joins someone who's waiting, or creates a waiting
// slot. Pairing is opt-in and there's always a solo fallback — this never blocks anyone from earning.
//
// Two behaviours added for the "book your next session" feature (all gated, all tiers):
//   • Availability: Buddy Chat is open to premium users too (BUDDY_PREMIUM_AVAILABLE, default on).
//   • Next-session gate: once a user has booked tomorrow's slot, they can't start a NEW session until that
//     chosen moment arrives — and when it does, we pair them, by preference, with buddies who chose the SAME
//     real-world moment (same utc_bucket), which is how cross-timezone buddies get coordinated.
//   Body: {}  → { status: "active"|"waiting"|"scheduled"|"disabled", pair_id?, buddy_user_id?, next_session_at? }
async function activePairFor(uid: string) {
  const a = await db.filter("BuddyPair", { user_a: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  if (a?.[0]) return a[0];
  const b = await db.filter("BuddyPair", { user_b: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  return b?.[0] || null;
}

/** Active (not-yet-used) booking for a user, if any. */
async function activeBooking(uid: string): Promise<Record<string, unknown> | null> {
  const booked = await db.filter("BuddyNextSession", { user_id: uid, status: "booked" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  if (booked?.[0]) return booked[0];
  const notified = await db.filter("BuddyNextSession", { user_id: uid, status: "notified" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  return notified?.[0] || null;
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!buddyEnabled()) return Response.json({ status: "disabled" });

    // Buddy Chat is available to premium users as well; an admin can hide it from premium via the setting.
    const premium = await isPremiumUser(user.id).catch(() => false);
    if (premium && !premiumAvailable()) return Response.json({ status: "disabled", reason: "premium_opted_out" });

    const existing = await activePairFor(user.id);
    if (existing) {
      const buddyId = existing.user_a === user.id ? existing.user_b : existing.user_a;
      return Response.json({ status: "active", pair_id: existing.id, buddy_user_id: buddyId });
    }

    // Next-session gate (all tiers): if the user booked a next slot, hold them until that moment, then consume it.
    let myBucket: string | null = null;
    let matchPref: MatchPreference = "any";
    let preferredUserId: string | null = null;
    if (bookingEnabled()) {
      const booking = await activeBooking(user.id);
      if (booking) {
        const at = String(booking.next_session_at || "");
        if (at && !withinStartWindow(at)) {
          return Response.json({
            status: "scheduled",
            next_session_at: at,
            local_time: booking.local_time ?? null,
            timezone: booking.timezone ?? null,
            match_preference: booking.match_preference ?? "any",
            note: `Your next Buddy Chat is booked for ${booking.local_time ?? at}. It will open automatically then.`,
          });
        }
        // The chosen moment has arrived — consume the booking; use its bucket + preference to steer matching.
        myBucket = booking.utc_bucket ? String(booking.utc_bucket) : null;
        matchPref = (booking.match_preference as MatchPreference) || "any";
        preferredUserId = booking.preferred_user_id ? String(booking.preferred_user_id) : null;
        await db.update("BuddyNextSession", String(booking.id), { status: "consumed", consumed_at: new Date().toISOString() }).catch(() => null);
      }
    }

    // Join someone who's waiting (not me). Preference order:
    //   • same utc_bucket first (cross-timezone coordination — buddies who chose the same real moment),
    //   • then, for a "new buddy" booking, the KYC-survey-most-compatible stranger (excluding past buddies),
    //   • otherwise a country the user chose to chat with, then anyone waiting.
    const waiting = await db.filter("BuddyPair", { status: "waiting" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
    const prefCountries = Array.isArray((user as Record<string, unknown>).chat_countries) ? (user as Record<string, unknown>).chat_countries as string[] : [];
    let openCandidates = (waiting || []).filter((p) => p.user_a && p.user_a !== user.id && !p.user_b);

    // Highest priority: someone INVITED me by picking my profile — pair us so their pick is honored.
    let open: Record<string, unknown> | undefined = openCandidates.find((p) => p.invited_user_id && String(p.invited_user_id) === String(user.id));

    // I PICKED a specific member (browse → pick, or a scheduled pick) — prefer their waiting slot if present.
    if (!open && preferredUserId) {
      open = openCandidates.find((p) => String(p.user_a) === preferredUserId);
    }

    // "New buddy" request: exclude anyone this user has been paired with before, and rank by KYC compatibility.
    if (!open && matchPref === "new") {
      const priors = await priorBuddyIds(user.id);
      const fresh = openCandidates.filter((p) => !priors.has(String(p.user_a)));
      const bucketFresh = myBucket ? fresh.filter((p) => String(p.utc_bucket) === myBucket) : [];
      const pool = (bucketFresh.length ? bucketFresh : fresh).slice(0, 12);
      const myKyc = (user as Record<string, unknown>).kyc_answers as Record<string, unknown> | undefined;
      let best: { p: Record<string, unknown>; score: number } | null = null;
      for (const p of pool) {
        const cand = await base44.asServiceRole.entities.User.filter({ id: String(p.user_a) }).then((r: any) => r[0]).catch(() => null);
        const score = kycAffinity(myKyc, cand?.kyc_answers);
        if (!best || score > best.score) best = { p, score };
      }
      open = best?.p; // highest-affinity fresh candidate (falls through to a waiting slot if none)
    } else if (!open && matchPref === "keep") {
      // Try to reunite with the most recent buddy if they're waiting.
      const priorsArr = [...(await priorBuddyIds(user.id))];
      open = openCandidates.find((p) => priorsArr.includes(String(p.user_a)));
    }

    open = open ||
      (myBucket ? openCandidates.find((p) => p.utc_bucket && String(p.utc_bucket) === myBucket) : undefined) ||
      (prefCountries.length ? openCandidates.find((p) => p.country && prefCountries.includes(String(p.country))) : undefined) ||
      openCandidates[0];
    if (open) {
      await db.update("BuddyPair", open.id as string, { user_b: user.id, status: "active", matched_at: new Date().toISOString() }).catch(() => null);
      // Let the waiting user know they've been matched.
      await base44.asServiceRole.entities.Notification.create({
        user_id: open.user_a, type: "social", title: "👥 You've got an earning buddy!",
        message: "Someone just paired up with you — cheer each other on and keep earning.",
      }).catch(() => null);
      return Response.json({ status: "active", pair_id: open.id, buddy_user_id: open.user_a });
    }

    // Otherwise wait for a partner (solo earning still works meanwhile). Tag with the user's country so
    // others who chose to chat with that country can be matched.
    const created = await base44.asServiceRole.entities.BuddyPair.create({
      user_a: user.id, user_b: null, status: "waiting", source: "queue",
      country: (user as Record<string, unknown>).country || null,
      utc_bucket: myBucket,   // cross-timezone coordination: same chosen moment → same bucket → matched
      match_preference: matchPref,
      created_day: new Date().toISOString().slice(0, 10),
    });
    return Response.json({ status: "waiting", pair_id: created.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
