import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { normalizeTier, recordSocialAmplification, userSocialReach } from "../../sdk/social-amplification.ts";

// socialAmplifyConfirm — the "I posted it" confirmation for an amplified ad. Records a SocialAmplificationEvent
// carrying the member's reach → estimated impressions → $ value, attributed to the advertiser + tier, so it
// counts toward the advertiser's delivered ad value and measured ROI. Marks the post delivered.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const post = await db.get("SocialMediaPost", String(body.post_id ?? "")).catch(() => null) as Record<string, unknown> | null;
    if (!post || post.user_id !== user.id) return Response.json({ error: "Post not found." }, { status: 404 });
    if (post.delivered) return Response.json({ error: "Already confirmed." }, { status: 409 });

    // Reach: the member's stored social_reach, else recompute from their active connections.
    let reach = Math.max(0, Number(user.social_reach) || Number(post.reach) || 0);
    if (reach <= 0) {
      const conns = await base44.asServiceRole.entities.SocialMediaConnection.filter({ user_id: user.id, is_active: true }).then((r: any) => r || []).catch(() => []);
      reach = userSocialReach(conns);
    }

    const contrib = await recordSocialAmplification(db, {
      advertiser_id: String(post.advertiser_id), tier: normalizeTier(post.tier), user_id: user.id,
      reach, platform: String(body.platform ?? post.platform ?? ""), post_id: String(post.id), todayISO: new Date().toISOString(),
    });

    return Response.json({
      success: true, post_id: post.id, contribution: contrib,
      note: "Recorded — this reach now counts toward the advertiser's delivered ad value. Your posting reward is credited through the normal rewards flow.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
