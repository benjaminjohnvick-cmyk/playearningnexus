import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { annualEarnCeiling, DAILY_EARN_CAP, PPC_GRID_ANNUAL_PRICE } from "../../sdk/premium-ppc.ts";
import { WELCOME_BONUS } from "../../sdk/premium-boost.ts";

// premiumPPCEnroll — a user joins the (free) Premium PPC program.
//
// NO-PENALTY MODEL: enrollment requires explicit T&C consent. A card on file is now OPTIONAL and is
// NEVER used to charge for missed days (there are none) — the user earns points as they go and owes
// nothing. Enforces the 1:1 advertiser⇄user cap: there must be an unmatched paying advertiser slot.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const consent = body.consent ?? {};
    if (consent.accepted !== true || !consent.terms_version) {
      return Response.json({ error: "You must accept the Premium PPC terms (consent.accepted + terms_version required)." }, { status: 400 });
    }
    // A card on file is OPTIONAL — kept only if you later add a paid membership tier. It is NEVER
    // charged for missed days.
    const paymentMethodId = body.payment_method_id ?? null;

    // Already enrolled?
    const existing = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const active = (existing || []).find((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached");
    if (active) return Response.json({ error: "You are already enrolled in Premium PPC.", membership: active }, { status: 409 });

    // --- 1:1 advertiser slot check ---
    // Advertisers = users active on the paid PPC grid. Each backs at most one premium user.
    const advertisers = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true });
    const memberships = await base44.asServiceRole.entities.PremiumPPCMembership.list("-created_date", 5000);
    const taken = new Set((memberships || [])
      .filter((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached")
      .map((m: Record<string, unknown>) => m.advertiser_user_id));
    const openAdvertiser = (advertisers || []).find((a: Record<string, unknown>) => a.id !== user.id && !taken.has(a.id));
    if (!openAdvertiser) {
      return Response.json({
        error: "No advertiser slots available. Premium PPC is capped 1:1 to paying advertisers.",
        advertisers: (advertisers || []).length,
        matched: taken.size,
      }, { status: 409 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const membership = await base44.asServiceRole.entities.PremiumPPCMembership.create({
      user_id: user.id,
      advertiser_user_id: openAdvertiser.id,
      payment_method_id: paymentMethodId, // optional; never charged for missed days
      consent: { accepted: true, terms_version: consent.terms_version, at: new Date().toISOString(), ip },
      grid_price: PPC_GRID_ANNUAL_PRICE,
      annual_earn_ceiling: annualEarnCeiling(),
      daily_earn_cap: DAILY_EARN_CAP,
      points_earned_total: WELCOME_BONUS,
      streak: 0,
      met_days: 0,
      missed_days: 0,
      business_refund_credit: 0,
      social_credit_to_advertiser: 0,
      status: "active",
      enrolled_at: new Date().toISOString(),
    });

    // Welcome bonus — a genuine reward for joining (EARNED, not an advance; nothing is repaid).
    if (WELCOME_BONUS > 0) {
      const bal = Math.round((Number(user.current_balance ?? 0) + WELCOME_BONUS) * 100) / 100;
      await base44.asServiceRole.entities.User.update(user.id, { current_balance: bal }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "premium_welcome_bonus",
        title: `🎁 $${WELCOME_BONUS} Welcome Bonus!`,
        message: `Welcome to Premium PPC — here's $${WELCOME_BONUS} in points to start. Your first weeks earn at an accelerated rate, and keeping a daily streak earns even more.`,
        is_read: false,
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      membership,
      matched_advertiser_id: openAdvertiser.id,
      annual_earn_ceiling: annualEarnCeiling(),
      daily_earn_cap: DAILY_EARN_CAP,
      welcome_bonus: WELCOME_BONUS,
      note: `You start with a $${WELCOME_BONUS} welcome bonus, then earn points as you go — accelerated ` +
        `in your first weeks and boosted by daily streaks, up to $${annualEarnCeiling()}/year. Missed days ` +
        `simply don't earn — there is no charge, no debt, and nothing to repay.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
