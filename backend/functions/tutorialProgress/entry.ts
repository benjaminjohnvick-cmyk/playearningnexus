import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { trackSteps, type Track } from "../../sdk/tutorial-content.ts";

// tutorialProgress — save/get a user's progress through the interactive tutorial, and mark it complete. On first
// completion it can grant a small Site-Cash reward (config; 0 = none). Site Cash only — a member reward, never
// real money. Gated behind TUTORIAL_ENABLED.
//
// Body: { action:"get" } | { action:"save", track, step_id } | { action:"complete", track }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("TUTORIAL_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Tutorial is off (TUTORIAL_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get");
    const track: Track = body?.track === "business" ? "business" : "non_business";

    const load = async () => (await db.filter("TutorialProgress", { user_id: user.id, track }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;

    if (action === "get") {
      // First-time detection: if the user has NO tutorial progress for EITHER track, the tutorial should
      // auto-activate on this (first) login. Suggest the track from the user's role.
      const anyRow = (await db.filter("TutorialProgress", { user_id: user.id }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;
      const p = await load();
      const suggestedTrack: Track = (user.role === "business" || user.is_seller === true || user.seller_active === true) ? "business" : "non_business";
      return Response.json({
        ok: true, track, progress: p ?? { completed_steps: [], completed: false },
        first_time: !anyRow,
        autostart: !anyRow,               // client auto-launches the tutorial on first login
        suggested_track: suggestedTrack,
        note: !anyRow ? "First login — auto-start the interactive tutorial." : "Returning user — tutorial available from Help.",
      });
    }

    if (action === "save") {
      const stepId = String(body?.step_id || "");
      if (!stepId) return Response.json({ error: "step_id required" }, { status: 400 });
      const p = await load();
      const done = new Set<string>(Array.isArray(p?.completed_steps) ? (p!.completed_steps as string[]).map(String) : []);
      done.add(stepId);
      const patch = { completed_steps: [...done], updated_at: new Date().toISOString() };
      if (p?.id) await db.update("TutorialProgress", String(p.id), patch).catch(() => null);
      else await db.create("TutorialProgress", { user_id: user.id, track, completed: false, ...patch, created_at: new Date().toISOString() }, user.email ?? String(user.id)).catch(() => null);
      return Response.json({ ok: true, track, completed_steps: patch.completed_steps });
    }

    if (action === "complete") {
      const total = trackSteps(track).length;
      const p = await load();
      if (p?.completed === true) return Response.json({ ok: true, track, already_complete: true, rewarded: false });

      // Grant the (Site-Cash) completion reward once, if configured. Points = Site Cash. Never real money.
      const rewardUsd = Math.max(0, await getNumber("TUTORIAL_COMPLETION_REWARD", 0));
      let rewardedPoints = 0;
      if (rewardUsd > 0) {
        const ppv = Math.max(0.0001, (await getNumber("POINT_VALUE_CENTS", 1)) / 100);
        rewardedPoints = Math.round(rewardUsd / ppv);
        await db.incrementField("User", String(user.id), "points", rewardedPoints).catch(() => null);
      }
      const patch = { completed: true, completed_at: new Date().toISOString(), completed_all_of: total, reward_points: rewardedPoints };
      if (p?.id) await db.update("TutorialProgress", String(p.id), patch).catch(() => null);
      else await db.create("TutorialProgress", { user_id: user.id, track, completed_steps: [], ...patch, created_at: new Date().toISOString() }, user.email ?? String(user.id)).catch(() => null);

      return Response.json({ ok: true, track, completed: true, rewarded: rewardedPoints > 0, reward_points: rewardedPoints, note: rewardedPoints > 0 ? "Tutorial complete — Site Cash reward credited." : "Tutorial complete." });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
