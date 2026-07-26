import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  BUSINESS_REFUND_PER_DAY, chargeSavedCardOffSession, DAILY_MIN_EARN, hasDoubled,
  liveChargesEnabled, MISSED_DAY_CHARGE, round2, SOCIAL_CREDIT_PER_DAY, utcDay,
} from "../../sdk/premium-ppc.ts";

// premiumPPCDailyReconcile — runs once/day (scheduler, service token).
// For each active member who took an advance and still owes their half:
//   • If they earned >= $8 today → nothing owed today (recorded as "met").
//   • If they earned < $8 → charge $8 to their card (off-session; simulated unless live charges
//     are on), credit that $8 back to the matched advertiser (cash refund, capped at 50% of grid),
//     and grant the advertiser 4×$8 = $32 in social-media marketing credit ON TOP of the refund.
// Idempotent per (member, day): a day already processed is skipped.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    // Service/admin only (the scheduler calls this with a service token = seed admin).
    if (!user || (user.role !== "admin" && body.scheduled !== true)) {
      return Response.json({ error: "Forbidden (admin/scheduler only)." }, { status: 403 });
    }

    const today = utcDay();
    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ status: "active" }, "-created_date", 5000);

    let processed = 0, charged = 0, met = 0, failed = 0, skipped = 0;
    let totalRefunded = 0, totalSocial = 0;
    const details: unknown[] = [];

    for (const m of (members || [])) {
      const disbursed = round2(m.advance_disbursed ?? 0);
      const repaid = round2(m.repaid_to_advertiser ?? 0);
      const owed = round2(disbursed - repaid);
      if (disbursed <= 0 || owed <= 0) { skipped++; continue; } // nothing to reconcile

      // Idempotency: already processed this member today?
      const todays = await base44.asServiceRole.entities.PremiumPPCCharge.filter({ membership_id: m.id, date: today });
      if ((todays || []).length) { skipped++; continue; }

      processed++;

      // Did the user earn >= $8 today?
      const earnRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: m.user_id });
      const earnedToday = round2((earnRows || [])
        .filter((e: Record<string, unknown>) => String(e.date ?? e.created_date ?? "").slice(0, 10) === today)
        .reduce((s: number, e: Record<string, unknown>) => s + (Number(e.amount) || 0), 0));

      if (earnedToday >= DAILY_MIN_EARN) {
        met++;
        await base44.asServiceRole.entities.PremiumPPCCharge.create({
          membership_id: m.id, user_id: m.user_id, advertiser_user_id: m.advertiser_user_id,
          date: today, earned_today: earnedToday, amount_charged: 0,
          advertiser_cash_credit: 0, advertiser_social_credit: 0, status: "met",
          created_at: new Date().toISOString(),
        }).catch(() => null);
        continue;
      }

      // Missed day → charge the user min($8, remaining owed) so we never charge past the advance.
      const chargeAmt = round2(Math.min(MISSED_DAY_CHARGE, owed));
      // Business gets 50% of the day's charge ($4) as STORE CREDIT; platform keeps the other $4.
      const businessRefund = round2((chargeAmt / MISSED_DAY_CHARGE) * BUSINESS_REFUND_PER_DAY);
      const platformKeep = round2(chargeAmt - businessRefund);

      const result = await chargeSavedCardOffSession({
        customerId: m.stripe_customer_id, paymentMethodId: m.payment_method_id,
        amount: chargeAmt,
        description: `GamerGain Premium PPC — missed-day charge ${today} ($${chargeAmt})`,
        metadata: { user_id: m.user_id, membership_id: m.id, type: "premium_ppc_missed_day", date: today },
      });

      if (!result.ok) {
        failed++;
        await base44.asServiceRole.entities.PremiumPPCCharge.create({
          membership_id: m.id, user_id: m.user_id, advertiser_user_id: m.advertiser_user_id,
          date: today, earned_today: earnedToday, amount_charged: 0,
          business_refund_credit: 0, advertiser_social_credit: 0,
          status: "failed", error: result.error, created_at: new Date().toISOString(),
        }).catch(() => null);
        details.push({ member: m.id, status: "failed", error: result.error });
        continue;
      }

      // Credit the matched advertiser: $4 STORE CREDIT (refund) + $32 social credit — but the social
      // credit only flows until the advertiser has DOUBLED their investment ($10,000 in orders).
      const advertiser = await base44.asServiceRole.entities.User.filter({ id: m.advertiser_user_id });
      const adv = (advertiser || [])[0] ?? {};
      const doubled = hasDoubled(Number(adv.ppc_orders_value_delivered ?? 0));
      const socialCredit = doubled ? 0 : round2((chargeAmt / MISSED_DAY_CHARGE) * SOCIAL_CREDIT_PER_DAY);

      const newRefundBal = round2(Number(adv.refund_credit_balance ?? 0) + businessRefund);
      const newSocialBal = round2(Number(adv.social_marketing_credit_balance ?? 0) + socialCredit);
      await base44.asServiceRole.entities.User.update(m.advertiser_user_id, {
        refund_credit_balance: newRefundBal,
        social_marketing_credit_balance: newSocialBal,
      }).catch(() => null);

      const newRepaid = round2(repaid + chargeAmt);
      const newBizRefund = round2((m.business_refund_credit ?? 0) + businessRefund);
      const newSocialTotal = round2((m.social_credit_to_advertiser ?? 0) + socialCredit);
      const fullyRepaid = newRepaid >= disbursed;
      await base44.asServiceRole.entities.PremiumPPCMembership.update(m.id, {
        repaid_to_advertiser: newRepaid,
        business_refund_credit: newBizRefund,
        social_credit_to_advertiser: newSocialTotal,
        status: fullyRepaid ? "repaid" : "active",
        last_charge_date: today,
      });

      await base44.asServiceRole.entities.PremiumPPCCharge.create({
        membership_id: m.id, user_id: m.user_id, advertiser_user_id: m.advertiser_user_id,
        date: today, earned_today: earnedToday, amount_charged: chargeAmt,
        business_refund_credit: businessRefund, platform_kept: platformKeep,
        advertiser_social_credit: socialCredit, advertiser_doubled: doubled,
        stripe_payment_intent: result.id, simulated: result.simulated, status: "charged",
        created_at: new Date().toISOString(),
      }).catch(() => null);

      await base44.asServiceRole.entities.AdTransaction.create({
        user_id: m.user_id, advertiser_user_id: m.advertiser_user_id, type: "premium_ppc_missed_day",
        amount: -chargeAmt, business_refund_credit: businessRefund, platform_kept: platformKeep,
        advertiser_social_credit: socialCredit,
        description: `Missed-day charge $${chargeAmt}; business +$${businessRefund} store credit${socialCredit ? ` + $${socialCredit} social` : " (doubled — social stopped)"}; platform +$${platformKeep}`,
        stripe_id: result.id, simulated: result.simulated, created_at: new Date().toISOString(),
      }).catch(() => null);

      charged++;
      totalRefunded = round2(totalRefunded + businessRefund);
      totalSocial = round2(totalSocial + socialCredit);
      details.push({ member: m.id, status: "charged", amount: chargeAmt, social: socialCredit, simulated: result.simulated, fully_repaid: fullyRepaid });
    }

    return Response.json({
      success: true, date: today, live_mode: liveChargesEnabled(),
      processed, charged, met, failed, skipped,
      total_refunded_to_advertisers: totalRefunded, total_social_credit_granted: totalSocial,
      details,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
