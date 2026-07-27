import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { AFFILIATE_ACTIVATION_THRESHOLD, bountyFor, commissionMode, ongoingRateFor, resolveTier } from "../../sdk/affiliate.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";

// Largest credible per-event referral earning. Anything above this is treated as an injection
// attempt and rejected — a real earning event is at most a few dollars.
const MAX_COMMISSIONABLE_EARN = 10000;

// distributeMLMBonus (AFFILIATE engine) — SINGLE-TIER, pays ONLY the direct referrer. No downline.
//
// Two modes (AFFILIATE_COMMISSION_MODE):
//   • "ongoing" (default): a recurring commission — a % of EACH referral earning, rate scaled by the
//     affiliate's tier. Recurring "residual" income; still single-tier (not MLM).
//   • "bounty": a one-time flat bounty when a referral first becomes active, scaled by tier.
//
// Payload: { user_id, amount?, source? }
export default __handler(async (req) => {
  try {
    // Credit-granting: only other server functions (internal invoke), schedulers, or admins may call.
    const denied = await requireInternalOrAdmin(req);
    if (denied) return denied;

    const base44 = createClientFromRequest(req);
    const { user_id, amount } = await req.json();
    if (!user_id) return Response.json({ error: "user_id required" }, { status: 400 });
    // Bound the client-supplied earning so a caller can't inject an arbitrary commission base.
    const amountNum = Number(amount);
    if (amount !== undefined && (!Number.isFinite(amountNum) || amountNum < 0 || amountNum > MAX_COMMISSIONABLE_EARN)) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: user_id });
    const referral = (referrals || [])[0];
    if (!referral) return Response.json({ message: "No referrer — skipping", user_id });
    const affiliateId = referral.referrer_user_id || referral.level_1_referrer_id;
    if (!affiliateId) return Response.json({ message: "No affiliate on referral", referral_id: referral.id });

    const accounts = await base44.asServiceRole.entities.AffiliateAccount.filter({ user_id: affiliateId });
    const account = (accounts || [])[0];
    const mode = commissionMode();

    if (mode === "ongoing") {
      const earn = Number(amount) || 0;
      if (earn <= 0) return Response.json({ message: "No earning amount for a commission", user_id });

      // Count this referral toward the affiliate's tier the first time they generate a commission.
      const priorActive = Number(account?.active_referrals_count ?? 0);
      const firstTime = !referral.affiliate_activated;
      const activeReferrals = firstTime ? priorActive + 1 : priorActive;
      const tier = resolveTier(activeReferrals);
      const rate = ongoingRateFor(activeReferrals);
      const commission = round2(earn * rate);
      if (commission <= 0) return Response.json({ message: "Commission rounds to zero", earn, rate });

      if (!account) {
        await base44.asServiceRole.entities.AffiliateAccount.create({
          user_id: affiliateId, affiliate_credit_balance: commission, total_commissions_earned: commission,
          active_referrals_count: activeReferrals, tier: tier.name, created_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.AffiliateAccount.update(account.id, {
          affiliate_credit_balance: round2(Number(account.affiliate_credit_balance ?? 0) + commission),
          total_commissions_earned: round2(Number(account.total_commissions_earned ?? 0) + commission),
          active_referrals_count: activeReferrals, tier: tier.name,
        });
      }
      if (firstTime) {
        await base44.asServiceRole.entities.Referral.update(referral.id, { affiliate_activated: true, status: "active" }).catch(() => null);
      }
      await base44.asServiceRole.entities.Referral.update(referral.id, {
        commission_earned: round2(Number(referral.commission_earned ?? 0) + commission),
      }).catch(() => null);

      await base44.asServiceRole.entities.Notification.create({
        user_id: affiliateId, type: "affiliate_commission",
        title: `💰 Affiliate Commission: +$${commission.toFixed(2)}`,
        message: `You earned $${commission.toFixed(2)} (${Math.round(rate * 100)}% ${tier.name} rate) from a referral's activity. Keep sharing!`,
        is_read: false,
      }).catch(() => null);

      return Response.json({ success: true, mode, affiliate_id: affiliateId, commission, rate, tier: tier.name, active_referrals: activeReferrals });
    }

    // --- bounty mode (one-time per active referral) ---
    if (referral.affiliate_bounty_paid) return Response.json({ message: "Bounty already paid", referral_id: referral.id });
    const earnRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id });
    const cumEarned = (earnRows || []).reduce(
      (s: number, e: Record<string, unknown>) => s + (Number(e.amount ?? e.total_earned) || 0), 0);
    if (cumEarned < AFFILIATE_ACTIVATION_THRESHOLD) {
      return Response.json({ message: "Referred user not yet active", cumEarned, threshold: AFFILIATE_ACTIVATION_THRESHOLD });
    }
    const priorActive = Number(account?.active_referrals_count ?? 0);
    const newActive = priorActive + 1;
    const tier = resolveTier(newActive);
    const bounty = bountyFor(newActive);
    if (!account) {
      await base44.asServiceRole.entities.AffiliateAccount.create({
        user_id: affiliateId, affiliate_credit_balance: bounty, total_bounties_earned: bounty,
        active_referrals_count: newActive, tier: tier.name, created_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.AffiliateAccount.update(account.id, {
        affiliate_credit_balance: round2(Number(account.affiliate_credit_balance ?? 0) + bounty),
        total_bounties_earned: round2(Number(account.total_bounties_earned ?? 0) + bounty),
        active_referrals_count: newActive, tier: tier.name,
      });
    }
    await base44.asServiceRole.entities.Referral.update(referral.id, {
      affiliate_bounty_paid: true, affiliate_bounty_amount: bounty, status: "active", activated_at: new Date().toISOString(),
    }).catch(() => null);
    await base44.asServiceRole.entities.Notification.create({
      user_id: affiliateId, type: "affiliate_bounty",
      title: `💰 Affiliate Bounty: +$${bounty.toFixed(2)}!`,
      message: `A referral you drove just became active — you earned a $${bounty.toFixed(2)} ${tier.name} bounty. You now have ${newActive} active referrals!`,
      is_read: false,
    }).catch(() => null);
    return Response.json({ success: true, mode, affiliate_id: affiliateId, bounty, tier: tier.name, active_referrals: newActive });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }
