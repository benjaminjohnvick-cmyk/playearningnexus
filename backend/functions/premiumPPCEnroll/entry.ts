import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { annualEarnCeiling, DAILY_EARN_CAP, PPC_GRID_ANNUAL_PRICE, upfrontGrantEnabled, surveyCommitmentDays, surveyMinutesPerDay } from "../../sdk/premium-ppc.ts";
import { WELCOME_BONUS } from "../../sdk/premium-boost.ts";
import { getNumber } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";

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
    const upfront = upfrontGrantEnabled();
    const now = new Date().toISOString();

    // Re-enrollment gate: anyone who previously DEFAULTED (spent-out + behind → locked out) must accept
    // LOCKOUT MODE to rejoin — a daily in-app survey window at a time they choose.
    const priorDefault = (existing || []).some((m: Record<string, unknown>) => m.defaulted === true || m.status === "locked_out");
    if (upfront && priorDefault && consent.lockout_mode !== true) {
      return Response.json({ error: "Re-enrollment requires agreeing to lockout mode (a daily in-app survey window at a time you choose), because a previous term wasn't completed.", requires_lockout_mode: true }, { status: 409 });
    }

    // SINGLE-FLIGHT GUARD (up-front only, where a double grant would be $1,460): a deterministic-id claim
    // so a double-click can't create two memberships and grant the points twice. Removed on default so a
    // re-enrollment can proceed. Earn-as-you-go doesn't need this (its welcome bonus is trivial).
    if (upfront) {
      try { await db.create("PremiumEnrollClaim", { id: `pec_${user.id}`, user_id: user.id, at: now }); }
      catch { return Response.json({ error: "You're already enrolled (or an enrollment is in progress)." }, { status: 409 }); }
    }

    const ceilingUsd = annualEarnCeiling();
    const cents = Math.max(1, await getNumber("POINT_VALUE_CENTS", 1));
    const grantPoints = Math.round(ceilingUsd * (100 / cents)); // $1,460 → 146,000 pts at 1¢/pt
    const lockoutEnabled = priorDefault || consent.lockout_mode === true;

    const membership = await base44.asServiceRole.entities.PremiumPPCMembership.create({
      user_id: user.id,
      advertiser_user_id: openAdvertiser.id,
      payment_method_id: paymentMethodId, // optional; never charged for missed days
      consent: { accepted: true, terms_version: consent.terms_version, lockout_mode: lockoutEnabled, at: now, ip },
      grid_price: PPC_GRID_ANNUAL_PRICE,
      annual_earn_ceiling: ceilingUsd,
      daily_earn_cap: DAILY_EARN_CAP,
      upfront_grant: upfront,
      grant_points: upfront ? grantPoints : 0,
      grant_usd: upfront ? ceilingUsd : 0,
      points_earned_total: upfront ? grantPoints : WELCOME_BONUS,
      commitment_start: now,
      survey_requirement_days: surveyCommitmentDays(),
      survey_days: 0,
      last_survey_day: null,
      lockout_mode_enabled: lockoutEnabled,
      lockout_time: consent.lockout_time || null,
      defaulted: false,
      streak: 0,
      met_days: 0,
      missed_days: 0,
      business_refund_credit: 0,
      social_credit_to_advertiser: 0,
      status: "active",
      enrolled_at: now,
    });

    // Credit the member's balance: the FULL up-front grant (banked, non-cashable), or — in the safer
    // earn-as-you-go mode — just the welcome bonus. Nothing here is ever repaid or clawed back.
    const creditPoints = upfront ? grantPoints : WELCOME_BONUS;
    if (creditPoints > 0) {
      const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
      const bal = Math.round((Number(fresh.current_balance ?? 0) + creditPoints) * 100) / 100;
      const promo = Math.round((Number(fresh.boost_promo_points ?? 0) + creditPoints) * 100) / 100; // non-cashable marker
      await base44.asServiceRole.entities.User.update(user.id, { current_balance: bal, boost_promo_points: promo }).catch(() => null);
      await base44.asServiceRole.entities.Transaction.create({
        user_id: user.id, type: upfront ? "premium_upfront_grant" : "premium_welcome_bonus",
        amount_points: creditPoints, cashable: false,
        description: upfront ? `Premium PPC up-front grant (+${grantPoints} pts / $${ceilingUsd})` : `Premium welcome bonus`, at: now,
      }, user.id).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: upfront ? "premium_upfront_grant" : "premium_welcome_bonus",
        title: upfront ? `🎁 ${grantPoints.toLocaleString()} points added!` : `🎁 $${WELCOME_BONUS} Welcome Bonus!`,
        message: upfront
          ? `Your ${grantPoints.toLocaleString()} points ($${ceilingUsd}) are in your balance to spend now. Just complete ~${surveyMinutesPerDay()} min of surveys a day for a year — you can catch up anytime. Points are closed-loop and non-cashable; nothing is ever charged or owed.`
          : `Welcome to Premium PPC — here's $${WELCOME_BONUS} in points to start.`,
        is_read: false,
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      membership,
      matched_advertiser_id: openAdvertiser.id,
      model: upfront ? "upfront-grant" : "earn-as-you-go",
      annual_earn_ceiling: ceilingUsd,
      grant_points: upfront ? grantPoints : 0,
      survey_requirement_days: surveyCommitmentDays(),
      lockout_mode_enabled: lockoutEnabled,
      note: upfront
        ? `${grantPoints.toLocaleString()} points ($${ceilingUsd}) are yours up front. Complete ~${surveyMinutesPerDay()} min of surveys/day for a year (flexible catch-up). Points are closed-loop and non-cashable; nothing is ever repaid or clawed back — falling behind only affects future access.`
        : `You start with a $${WELCOME_BONUS} welcome bonus, then earn points as you go up to $${ceilingUsd}/year. Missed days simply don't earn — no charge, no debt, nothing to repay.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
