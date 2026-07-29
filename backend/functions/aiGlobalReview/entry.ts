import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { globalReviewWindow, listEligibleForGlobal } from "../../sdk/experiments.ts";

// aiGlobalReview (ADMIN) — the once-per-24h, peak-time human check. Returns whether the daily review
// window is open right now, and the changes that passed individual-user statistical approval and are
// waiting to be promoted site-wide. Approvals are only allowed while the window is open (aiGlobalDecide).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const [window, eligible] = await Promise.all([globalReviewWindow(), listEligibleForGlobal()]);
    return Response.json({
      window_open: window.open,
      peak_hour_utc: window.peak_hour_utc,
      window_hours: window.window_hours,
      next_open_iso: window.next_open_iso,
      eligible: (eligible || []).map((e) => ({
        id: e.id, key: e.key, from: e.control_value, to: e.variant_value,
        favor_pct: e.favor_pct, wilson_lower: e.wilson_lower, sample: e.sample,
        rationale: e.rationale, mockup: e.mockup, eligible_at: e.eligible_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
