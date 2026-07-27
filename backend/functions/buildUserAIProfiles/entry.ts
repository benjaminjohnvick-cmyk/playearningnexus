import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { compileProfile } from "../../sdk/user-profile.ts";

// buildUserAIProfiles (INTERNAL/ADMIN, scheduled) — refresh the compiled AI profile for recently
// active users so personalization stays current. Each user's per-visit call also compiles their own.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = await base44.asServiceRole.entities.DailyEarnings.filter({}).catch(() => []);
    const userIds = [...new Set(recent.filter((e: any) => (e.date || "") >= since).map((e: any) => e.user_id))].filter(Boolean).slice(0, 500);

    let built = 0;
    for (const uid of userIds) {
      await compileProfile(base44, uid as string).then(() => built++).catch(() => null);
    }
    return Response.json({ success: true, profiles_built: built });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
