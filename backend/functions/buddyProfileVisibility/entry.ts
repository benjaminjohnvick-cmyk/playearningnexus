import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { profileBrowseEnabled } from "../../sdk/buddy-profile.ts";

// buddyProfileVisibility (authenticated) — opt IN or OUT of the browsable buddy directory. Browsing is opt-in:
// a user's KYC-derived interest card is only shown to others once they turn this ON. No card content changes
// here; this only flips whether the user appears in buddyProfileBrowse.
//   Body: { public?: boolean }  — omit `public` to just read the current state.
//     → { ok, public }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!profileBrowseEnabled()) return Response.json({ ok: true, enabled: false, note: "Profile browsing is off (BUDDY_PROFILE_BROWSE_ENABLED)." });

    const b = await req.json().catch(() => ({}));
    if (typeof b.public === "boolean") {
      await db.update("User", user.id, { buddy_profile_public: b.public }).catch(() => null);
      return Response.json({ ok: true, enabled: true, public: b.public, note: b.public ? "Your interest profile is now visible to other members for buddy matching (first name + interests only)." : "Your profile is hidden from browsing." });
    }
    return Response.json({ ok: true, enabled: true, public: user.buddy_profile_public === true });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
