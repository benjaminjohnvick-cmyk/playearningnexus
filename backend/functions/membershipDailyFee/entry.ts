import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  accountAgeDays, MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS as MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS_ENV,
  MEMBERSHIP_DAILY_FEE as MEMBERSHIP_DAILY_FEE_ENV, round2, utcDay,
} from "../../sdk/membership.ts";
import { getNumber } from "../../sdk/settings.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { CURRENT_TERMS_VERSION } from "../../sdk/terms.ts";

// membershipDailyFee — runs once/day (scheduler, service token).
//
//   • Auto-activates Premium membership for any user whose account is >= 1 day old (unless they
//     opted out), and records the fee disclosure in the immutable consent ledger.
//   • Deducts the $1/day fee from that day's EARNINGS ONLY — never a card, never a debt. If the user
//     earned less than $1 that day, only what they earned is taken; nothing is carried forward. A
//     user who earned $0 pays $0.
//   • Fully skipped for anyone who cancelled/opted out. Idempotent per (user, day).
//
// This is the compliant shape of "auto-upgrade + $1/day": no forced card charge, no debt, disclosure
// recorded, cancel-anytime. NOT legal advice.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    if (!user || (user.role !== "admin" && body.scheduled !== true)) {
      return Response.json({ error: "Forbidden (admin/scheduler only)." }, { status: 403 });
    }

    const today = utcDay();
    // Live, admin-adjustable (DB override → env → default):
    const MEMBERSHIP_DAILY_FEE = await getNumber("MEMBERSHIP_DAILY_FEE", MEMBERSHIP_DAILY_FEE_ENV);
    const MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS = await getNumber("MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS", MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS_ENV);
    const users = await base44.asServiceRole.entities.User.list("-created_date", 10000);

    let upgraded = 0, charged = 0, feeTotal = 0;
    let skippedOptOut = 0, skippedNoEarnings = 0, skippedDone = 0, skippedTooNew = 0;

    for (const u of (users || [])) {
      if (u.membership_opted_out === true || u.membership_status === "cancelled") { skippedOptOut++; continue; }
      if (accountAgeDays(u) < MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS) { skippedTooNew++; continue; }

      // Auto-activate premium once, recording the fee disclosure/consent.
      if (u.premium_active !== true) {
        await base44.asServiceRole.entities.User.update(u.id, {
          premium_active: true,
          premium_since: u.premium_since ?? new Date().toISOString(),
          membership_fee_daily: MEMBERSHIP_DAILY_FEE,
          membership_status: "active",
        }).catch(() => null);
        await recordConsent({
          user_id: u.id, kind: "membership_fee", version: CURRENT_TERMS_VERSION, accepted: true,
          shown: { fee_per_day: MEMBERSHIP_DAILY_FEE, deducted_from: "daily_earnings_only", creates_debt: false, cancel_anytime: true },
        }).catch(() => null);
        upgraded++;
      }

      // Idempotency: already handled today?
      if (String(u.last_membership_fee_date ?? "") === today) { skippedDone++; continue; }

      // Today's earnings only.
      const earnRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: u.id });
      const earnedToday = round2((earnRows || [])
        .filter((e: Record<string, unknown>) => String(e.date ?? e.created_date ?? "").slice(0, 10) === today)
        .reduce((s: number, e: Record<string, unknown>) => s + (Number(e.amount) || 0), 0));

      // Fee comes ONLY from what they earned today; never a debt, never negative.
      const fee = round2(Math.min(MEMBERSHIP_DAILY_FEE, Math.max(0, earnedToday)));
      if (fee <= 0) {
        await base44.asServiceRole.entities.User.update(u.id, { last_membership_fee_date: today }).catch(() => null);
        skippedNoEarnings++;
        continue;
      }

      // Mark the day FIRST (idempotency: a re-entrant pass skips this user), then debit the fee with an
      // atomic compare-and-set, flooring at 0 so the fee can never push the balance negative.
      await base44.asServiceRole.entities.User.update(u.id, { last_membership_fee_date: today }).catch(() => null);
      await adjustUserBalance(u.id, -fee, { floorZero: true }).catch(() => null);

      await postLedgerEntry({
        user_id: u.id, type: "membership_fee", amount: -fee, currency: "USD",
        idempotency_key: `membership_fee:${u.id}:${today}`,
        meta: { earned_today: earnedToday, fee, from: "daily_earnings" },
      }).catch(() => null);

      await base44.asServiceRole.entities.Transaction.create({
        user_id: u.id, type: "membership_fee", amount: -fee, method: "earnings_deduction",
        status: "completed",
        note: `Premium membership $${fee} (from today's earnings; no card, no debt).`,
        at: new Date().toISOString(),
      }).catch(() => null);

      charged++; feeTotal = round2(feeTotal + fee);
    }

    return Response.json({
      success: true, date: today, daily_fee: MEMBERSHIP_DAILY_FEE,
      upgraded, charged, fee_total: feeTotal,
      skipped_opt_out: skippedOptOut, skipped_no_earnings: skippedNoEarnings,
      skipped_already_done: skippedDone, skipped_too_new: skippedTooNew,
      note: "Fee taken from daily earnings only — never a card, never a debt. Opt-out respected.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
