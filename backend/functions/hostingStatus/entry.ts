import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber, snapBool } from "../../sdk/settings.ts";
import { hostingUnlockState, sumDailyEarnings } from "../../sdk/hosting-access.ts";

// hostingStatus (authenticated) — "earn $4 today → unlock hosting." Returns today's earnings vs the unlock
// threshold, whether hosting is unlocked, and the $1/day membership fee that comes out of those earnings. Any
// earning source counts (surveys, offers, buddy chat), so this is what the UI polls to show "you're $X from
// unlocking hosting." Honest framing: this is an unlock CONDITION, never an income guarantee.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const gateOn = snapBool("HOSTING_UNLOCK_ENABLED", false);
    const threshold = await getNumber("HOSTING_DAILY_EARN_UNLOCK_USD", 4);
    const fee = await getNumber("MEMBERSHIP_DAILY_FEE", 1);

    const rows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today }).catch(() => []) as Array<Record<string, unknown>>;
    const earnedToday = sumDailyEarnings(rows);
    const st = hostingUnlockState({ earnedTodayUsd: earnedToday, unlockThresholdUsd: threshold, membershipFeeUsd: fee });

    // When the gate is OFF, hosting isn't earnings-gated at all (unlocked=true), but we still report the numbers
    // so the UI can show the daily progress.
    return Response.json({
      ok: true,
      gate_enabled: gateOn,
      unlocked: gateOn ? st.unlocked : true,
      ...st,
      allow_nongame: snapBool("HOSTING_ALLOW_NONGAME", false),
      note: !gateOn
        ? "Hosting earnings-gate is off — hosting is open."
        : st.unlocked
          ? "Hosting unlocked for today. The $1/day membership fee is covered from today's earnings."
          : `Earn ${(st.remaining_to_unlock_usd).toFixed(2)} more today to unlock hosting. Any earning counts — surveys, offers, or buddy chat. (This is an unlock condition, not an earnings guarantee.)`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
