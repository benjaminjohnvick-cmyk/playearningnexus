import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { profileBrowseEnabled, buildBuddyCard, isProfilePublic } from "../../sdk/buddy-profile.ts";
import { premiumAvailable } from "../../sdk/buddy-schedule.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";

// buddyProfileBrowse (authenticated) — browse other members' KYC-derived interest profiles and pick your own
// match, instead of relying only on the auto-matcher. Returns privacy-safe cards (first name + interest fields
// only) for members who opted their profile public, ranked by how much they have in common with you (KYC
// affinity). Read-only. Gated behind BUDDY_PROFILE_BROWSE_ENABLED; available to every tier.
//   Body: { limit?, cursor?, country?, q? }
//     → { ok, cards: BuddyCard[], next_cursor? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!profileBrowseEnabled()) return Response.json({ ok: true, enabled: false, cards: [], note: "Profile browsing is off (BUDDY_PROFILE_BROWSE_ENABLED)." });

    const premium = await isPremiumUser(user.id).catch(() => false);
    if (premium && !premiumAvailable()) return Response.json({ ok: true, enabled: false, cards: [], note: "Buddy Chat is not enabled for premium accounts." });

    const b = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(b.limit) || 30, 60));
    const country = b.country ? String(b.country).toUpperCase() : null;
    const q = b.q ? String(b.q).toLowerCase().trim() : null;

    // Public, buddy-eligible members (bounded scan), excluding self. Filtered on the opt-in flag.
    const query: Record<string, unknown> = { buddy_profile_public: true };
    if (country) query.country = country;
    const pool = await db.filter("User", query, "-updated_date", 400).catch(() => []) as Record<string, unknown>[];

    const myKyc = (user as Record<string, unknown>).kyc_answers as Record<string, unknown> | undefined;
    let cards = (pool || [])
      .filter((u) => String(u.id) !== String(user.id) && isProfilePublic(u))
      .map((u) => buildBuddyCard(u, myKyc));

    // Optional free-text filter over the visible interest fields.
    if (q) {
      cards = cards.filter((c) =>
        [c.display_name, ...(c.interests || []), ...(c.goals || []), ...(c.game_genres || []), c.style || "", c.device || ""]
          .join(" ").toLowerCase().includes(q));
    }

    // Rank by shared interests (KYC affinity), highest first.
    cards.sort((a, z) => z.affinity - a.affinity);

    return Response.json({
      ok: true, enabled: true,
      count: cards.length,
      cards: cards.slice(0, limit),
      note: "Browse members by shared interests, then pick one with buddyPickMatch. Cards show first name + interests only.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
