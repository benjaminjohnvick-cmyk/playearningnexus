import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { videoEngineEnabled, videoPlaybookFor, videoRecommendations } from "../../sdk/video-engine.ts";

// aiVideoEngineLearn — rebuild the self-learning video playbook from all recorded outcomes and return the
// winning value per dimension plus plain-language recommendations. The generator reads playbook.top to
// re-bias the next sample, so calling this makes the next batch smarter. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!videoEngineEnabled()) return Response.json({ error: "The AI Video Engine is disabled." }, { status: 403 });

    const now = new Date().toISOString();
    const playbook = await videoPlaybookFor(db, now);
    return Response.json({
      ok: true,
      sample_size: playbook.sample_size,
      top: playbook.top,
      dimensions: playbook.dimensions,
      recommendations: videoRecommendations(playbook),
      updated_at: now,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
