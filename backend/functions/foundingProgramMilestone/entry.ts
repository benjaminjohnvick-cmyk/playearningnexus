import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { milestoneState, FA_STATUS } from "../../sdk/founding-advertiser.ts";

// foundingProgramMilestone (ADMIN / internal) — evaluate the launch milestone and reconcile escrowed
// founding-advertiser records. Safe to run on a schedule.
//   • Milestone MET  → escrowed records become ACTIVE (advertising goes live, funds release per your escrow).
//   • Deadline PASSED and NOT met → escrowed records become REFUND_DUE (your escrow agent auto-refunds).
// This function never moves money — it flags state; the escrow agent/processor acts on the flags.
//   {} → { milestone, activated, refund_flagged }
export default __handler(async (req) => {
  const guard = await requireInternalOrAdmin(req);
  if (guard) return guard;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const m = await milestoneState(today);

    const escrowed = await db.filter("FoundingAdvertiser", { status: FA_STATUS.ESCROWED }, "-created_date", 200000)
      .catch(() => []) as Record<string, unknown>[];

    let activated = 0, refundFlagged = 0;
    if (m.met) {
      for (const r of escrowed) {
        const ok = await db.update("FoundingAdvertiser", r.id as string, { status: FA_STATUS.ACTIVE, milestone_met: true })
          .catch(() => null);
        if (ok) activated++;
      }
    } else if (m.past_deadline) {
      for (const r of escrowed) {
        const ok = await db.update("FoundingAdvertiser", r.id as string, { status: FA_STATUS.REFUND_DUE })
          .catch(() => null);
        if (ok) refundFlagged++;
      }
    }

    return Response.json({
      milestone: {
        target: m.target, current: m.current, users_met: m.users_met,
        founders_target: m.founders_target, founders_current: m.founders_current, founders_met: m.founders_met,
        met: m.met, deadline: m.deadline, past_deadline: m.past_deadline,
      },
      activated,
      refund_flagged: refundFlagged,
      note: m.met ? "Milestone met — escrowed advertisers activated." :
            m.past_deadline ? "Deadline passed without milestone — escrowed advertisers flagged for refund." :
            "Milestone not yet met; still within the window. No changes.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
