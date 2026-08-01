import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { coverageForDay, isFullyCovered, whoIsOn, type Shift } from "../../sdk/ops-shifts.ts";

// opsCoverageStatus (INTERNAL/ADMIN) — is the batch-approval desk covered 24/7? Returns who's on right now,
// today's hour-by-hour coverage, and any gaps to fill so a batch is never left waiting.
//   Body: {}  → { fully_covered, on_now, today, gaps_today, shifts }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const rows = await db.filter("OpsShift", { active: true }, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
    const shifts = rows.map((r) => ({
      operator_user_id: r.operator_user_id as string,
      operator_name: r.operator_name as string,
      tz: r.tz as string,
      start_hour_utc: Number(r.start_hour_utc) || 0,
      end_hour_utc: Number(r.end_hour_utc) || 0,
      days: Array.isArray(r.days) ? r.days as number[] : [],
      active: r.active !== false,
    })) as Shift[];

    const now = new Date();
    const hour = now.getUTCHours();
    const dow = now.getUTCDay();

    const onNow = whoIsOn(shifts, hour, dow).map((s) => ({ operator_name: s.operator_name, tz: s.tz }));
    const today = coverageForDay(shifts, dow);

    return Response.json({
      utc_hour: hour,
      utc_dow: dow,
      fully_covered: isFullyCovered(shifts),
      covered_now: onNow.length > 0,
      on_now: onNow,
      today_coverage_hours: today.hours,     // 24 numbers = operators per UTC hour today
      gaps_today: today.gaps,                // UTC hours with nobody on
      covered_hours_today: today.covered_hours,
      operator_count: shifts.length,
      shifts: rows.map((r) => ({ id: r.id, operator_name: r.operator_name, tz: r.tz, start_hour_utc: r.start_hour_utc, end_hour_utc: r.end_hour_utc, days: r.days, active: r.active })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
