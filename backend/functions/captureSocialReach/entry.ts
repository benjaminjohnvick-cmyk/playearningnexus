import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { captureUserSocialReach } from "../../sdk/social-amplification.ts";

// captureSocialReach — capture / refresh a member's social follower reach ("take the social media counts of
// users who sign up"). Sums their active connections' follower counts, plus any explicitly-supplied per-platform
// counts from the signup form, and stores it as `social_reach` on the User. Call at signup and on connect.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userId = (user.role === "admin" && body.user_id) ? String(body.user_id) : user.id;
    const followerCounts = (body.follower_counts && typeof body.follower_counts === "object") ? body.follower_counts as Record<string, number> : undefined;

    const reach = await captureUserSocialReach(db, userId, { followerCounts, todayISO: new Date().toISOString() });
    return Response.json({ success: true, user_id: userId, social_reach: reach });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
