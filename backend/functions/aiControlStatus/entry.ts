import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { aiPaused, recentAiActivity } from "../../sdk/ai-control.ts";

// aiControlStatus (ADMIN) — the real-time AI oversight view: is the AI paused, and what has it been
// doing lately (newest first). The frontend polls this to show a live feed.
//   Body: { limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { limit } = await req.json().catch(() => ({}));
    const [paused, activity] = await Promise.all([
      aiPaused().catch(() => false),
      recentAiActivity(Math.min(200, Math.max(10, Number(limit) || 60))),
    ]);
    return Response.json({ paused, activity });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
