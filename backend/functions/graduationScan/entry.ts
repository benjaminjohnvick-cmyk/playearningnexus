import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { runGraduation, liveEnabled } from "../../sdk/live-experiments.ts";

// graduationScan (INTERNAL/ADMIN, scheduled) — promotes segment winners to the whole site. For each
// segment experiment that won strongly (nominated when its lift ≥ GRADUATION_LIFT_PCT), it opens a
// site-wide 24h validation experiment. If that clears significance + guardrails, the normal tick()
// flips it globally with no downtime — reaching web, PWA, and native. Money/compliance keys can never
// enter this path.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await liveEnabled())) return Response.json({ success: true, skipped: "live experiments disabled" });
    const graduated = await runGraduation();
    return Response.json({ success: true, graduated_count: graduated.length, graduated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
