import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// exportMyData (DSAR — GDPR/CCPA right to access & data portability). Returns the current user's
// personal data across the key entities. Read-only; logs the request to the consent ledger.
const EXPORT_ENTITIES = [
  "Transaction", "Order", "DailyEarnings", "Payout", "PayoutRequest", "WithdrawalRequest",
  "Referral", "Notification", "ConsentRecord", "SocialMediaConnection", "SupportTicket",
  "PPCTransaction", "MoneyLedgerEntry", "PremiumPPCMembership",
  // Behavioral / AI data collected about the user (DSAR must include these).
  "UserJourneyEvent", "UXSessionRecording", "UserAIProfile", "SessionRating",
  "PricingFeedback", "SurveyHonestyAnalysis", "MarketplaceListing",
  // Broadened coverage — any of these that exist and are keyed to the user are included (missing → skipped).
  "SurveyResponse", "ContestEntry", "TournamentEntry", "UserActivity", "UserBadge", "AffiliatePurchase",
  "AdImpression", "AdTransaction", "PushSubscription", "StepUpVerification", "RedemptionRecord",
  "GeneratedImage", "Dispute", "ChatMessage", "BuddyChatMessage", "Wishlist", "WishlistItem",
  "PremiumAdFreeDay", "StreamerSubscription", "Subscription", "BusinessSubscription", "FoundingAdvertiser",
  "Tier2ScalingPlan", "AffiliateTier", "AppLog", "RespondentTrustScore", "PayoutPreference",
];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profile = { ...user } as Record<string, unknown>;
    delete profile.password_hash;
    delete profile.reset_token_hash;
    delete profile.reset_token_expires;

    // For each entity, try every field an entity might key the user by, so we don't silently miss records
    // stored under owner_user_id / referrer_user_id / created_by etc. (fuller DSAR coverage).
    const USER_KEYS = ["user_id", "owner_user_id", "referrer_user_id", "created_by", "member_id", "buyer_user_id", "recipient_user_id"];
    const data: Record<string, unknown> = { profile };
    for (const ent of EXPORT_ENTITIES) {
      const seen = new Map<string, Record<string, unknown>>();
      for (const key of USER_KEYS) {
        try {
          const rows = await db.filter(ent, { [key]: user.id }, "-created_date", 5000) as Record<string, unknown>[];
          for (const r of rows || []) { const id = String(r.id ?? Math.random()); if (!seen.has(id)) seen.set(id, r); }
        } catch { /* entity/field absent → skip */ }
      }
      data[ent] = [...seen.values()];
    }

    await recordConsent({ user_id: user.id, kind: "dsar_export", accepted: true }).catch(() => null);

    return Response.json({ success: true, exported_at: new Date().toISOString(), user_id: user.id, data });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
