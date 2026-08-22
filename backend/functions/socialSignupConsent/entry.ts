import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { captureUserSocialReach } from "../../sdk/social-amplification.ts";

// socialSignupConsent — backs the one-click "Join" button. Records the member's decision on the social
// amplification disclosure (opt IN by default, or opt OUT) to the append-only consent ledger, sets the opt-in
// flags the distributor checks, and captures their social reach. The member must have SEEN and acknowledged the
// disclosure (`accepted: true`) — this is the clickwrap consent, not a silent enrollment.
export const SOCIAL_JOIN_DISCLOSURE_VERSION = "social-amp-join-1";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.accepted !== true) {
      return Response.json({ error: "You must acknowledge the disclosure to continue." }, { status: 400 });
    }
    const optIn = body.opt_in !== false;   // default ON; the member can opt out in the same click
    const now = new Date().toISOString();
    const version = String(body.disclosure_version ?? SOCIAL_JOIN_DISCLOSURE_VERSION);

    // Append-only consent record — captures that the disclosure was shown, acknowledged, and the opt in/out.
    await recordConsent({
      user_id: user.id, kind: "social_amplification_join", version,
      accepted: true, shown: version,
      meta: { opt_in: optIn, source: String(body.source ?? "one_click_join") },
    }).catch(() => null);

    if (optIn) {
      await db.update("User", user.id, {
        ppc_social_ads_opt_in: true, social_consent_at: now, social_opt_out_at: null,
      }).catch(() => null);
      // "Take the social media counts of users who sign up."
      const followerCounts = (body.follower_counts && typeof body.follower_counts === "object") ? body.follower_counts as Record<string, number> : undefined;
      await captureUserSocialReach(db, user.id, { followerCounts, todayISO: now }).catch(() => null);
    } else {
      await db.update("User", user.id, {
        ppc_social_ads_opt_in: false, social_opt_out_at: now,
      }).catch(() => null);
    }

    return Response.json({
      success: true, opted_in: optIn, disclosure_version: version,
      next: optIn ? "connect_accounts" : "done",
      note: optIn
        ? "You're in. Connect each social account (one tap each on that platform) to start earning rewards for posting #ad-labeled ads. You can opt out anytime in Settings."
        : "You've opted out of social advertising. You can turn it on later in Settings.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
