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

    // Pending records awaiting the launch outcome — both the escrow-held and the (presale/hybrid) funded ones.
    const [escrowed, funded] = await Promise.all([
      db.filter("FoundingAdvertiser", { status: FA_STATUS.ESCROWED }, "-created_date", 200000).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("FoundingAdvertiser", { status: FA_STATUS.FUNDED }, "-created_date", 200000).catch(() => []) as Promise<Record<string, unknown>[]>,
    ]);
    const pending = [...(escrowed || []), ...(funded || [])];

    let activated = 0, refundFlagged = 0, launchUnmet = 0;
    if (m.met) {
      // Launch! Everyone who paid goes live; start their store-credit release clock now.
      for (const r of pending) {
        const patch: Record<string, unknown> = { status: FA_STATUS.ACTIVE, milestone_met: true };
        if (!r.credit_start) patch.credit_start = today;
        if (!r.fullkeep_start) patch.fullkeep_start = today;   // 100%-keep window starts at launch
        const ok = await db.update("FoundingAdvertiser", r.id as string, patch).catch(() => null);
        if (ok) activated++;
      }
    } else if (m.past_deadline) {
      for (const r of pending) {
        if (r.refundable === true) {
          // escrow / hybrid: flag the refundable portion for refund by the escrow agent
          const ok = await db.update("FoundingAdvertiser", r.id as string, { status: FA_STATUS.REFUND_DUE }).catch(() => null);
          if (ok) refundFlagged++;
        } else {
          // presale: non-refundable — no money back (this was disclosed and accepted at purchase)
          const ok = await db.update("FoundingAdvertiser", r.id as string, { status: FA_STATUS.LAUNCH_UNMET }).catch(() => null);
          if (ok) launchUnmet++;
        }
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
      launch_unmet: launchUnmet,
      note: m.met ? "Both milestones met — all funded/escrowed advertisers activated." :
            m.past_deadline ? "Deadline passed without both milestones — refundable portions flagged for refund; non-refundable presale purchases marked launch_unmet (no refund, as disclosed)." :
            "Milestones not yet met; still within the window. No changes.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
