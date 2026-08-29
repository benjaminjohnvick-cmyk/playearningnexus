import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { referralBonusAmount, type ReferralKind, type AdvertiserTier } from "../../sdk/referral-tiers.ts";

// referralBonusRecord — the documented HOOK the signup / advertiser-payment flow calls to register a pending
// two-tier referral bonus (all Site Cash). A USER referral is recorded ready-to-pay; an ADVERTISER referral
// is recorded PENDING and only becomes payable after its payment clears + the clawback window (enforced in
// referralBonusSweep). Idempotent per (referrer, referred, kind). Admin / seed-admin service only. It does
// NOT credit anything — the gated sweep does that, so nothing moves until the feature is enabled.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const referrer = String(body.referrer_user_id ?? "");
    const referred = String(body.referred_user_id ?? "");
    const kind = (body.kind === "advertiser" ? "advertiser" : "user") as ReferralKind;
    const tier = (["tier1", "tier2", "tier3"].includes(body.tier) ? body.tier : undefined) as AdvertiserTier | undefined;
    if (!referrer || !referred) return Response.json({ error: "referrer_user_id and referred_user_id are required." }, { status: 400 });
    if (referrer === referred) return Response.json({ error: "self-referral is not eligible." }, { status: 400 });

    // Idempotency — one bonus per (referrer, referred, kind).
    const existing = await db.filter("ReferralBonus", { referrer_user_id: referrer, referred_user_id: referred, kind }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
    if (existing?.[0]) return Response.json({ ok: true, deduped: true, bonus_id: existing[0].id, status: existing[0].status });

    const now = new Date().toISOString();
    const amount = referralBonusAmount(kind, tier);
    const doc = {
      referrer_user_id: referrer, referred_user_id: referred, kind, tier: tier ?? null,
      amount_sitecash: amount,
      payment_cleared_at: body.payment_cleared_at ? String(body.payment_cleared_at) : null,
      kyc_ok: body.kyc_ok === true, self_referral: false,
      refunded: false, chargeback: false,
      status: "pending",       // both start pending; the sweep decides eligibility (user=active, adv=cleared+clawback)
      created_at: now, updated_at: now,
    };
    const row = await db.create("ReferralBonus", doc).catch(() => null) as Record<string, unknown> | null;
    return Response.json({ ok: true, bonus_id: row?.id ?? null, kind, tier: tier ?? null, amount_sitecash: amount, status: "pending" });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
