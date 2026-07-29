import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { utcDay } from "../../sdk/premium-ppc.ts";
import { dailyRequirementMet, renewalDue } from "../../sdk/loyalty.ts";

// loyaltyDailyReconcile (INTERNAL/ADMIN, scheduled daily) — tracks each enrolled member's active-day
// tally toward the 5-day/week term (for members who completed the day's PPC-survey requirement) and
// flags renewal when the one-year term is complete. The 10% discount is PLATFORM-ABSORBED (funded by
// the advertiser's grid payment) and accounted at checkout, so there is no per-day pool to accrue here.
// NEVER clawbacks: a missed day just doesn't count toward the week — no debt, no penalty.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const today = utcDay();
    const members = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, "-created_date", 100000).catch(() => []) as Record<string, unknown>[];

    let counted = 0, alreadyToday = 0, notEligible = 0, renewals = 0;
    for (const m of members) {
      if (m.status === "ended") continue;
      // Annual re-consent reminder (membership is indefinite; this does NOT end it).
      if (renewalDue(m) && m.renewal_due !== true) {
        await db.update("PremiumPPCMembership", String(m.id), { renewal_due: true }).catch(() => null);
        renewals++;
      }
      if (m.last_active_tally_day === today) { alreadyToday++; continue; }    // idempotent per day
      if (!dailyRequirementMet(m, today)) { notEligible++; continue; }        // must do today's surveys

      // Record the active day toward the 5-day/week tally (idempotent per day).
      const weekKey = today.slice(0, 4) + "-W" + isoWeek(today);
      const weekMap = (m.weekly_active_days && typeof m.weekly_active_days === "object") ? { ...(m.weekly_active_days as Record<string, number>) } : {};
      weekMap[weekKey] = (Number(weekMap[weekKey]) || 0) + 1;
      await db.update("PremiumPPCMembership", String(m.id), { last_active_tally_day: today, weekly_active_days: weekMap }).catch(() => null);
      counted++;
    }

    return Response.json({ ok: true, day: today, members: members.length, active_days_counted: counted, already_today: alreadyToday, not_eligible: notEligible, reconsent_flagged: renewals });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

// ISO week number (1–53) from a YYYY-MM-DD string, for the 5-day/week tally.
function isoWeek(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return String(week).padStart(2, "0");
}
