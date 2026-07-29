import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// premiumAdDecide (authenticated) — the member acts on a queued ad post:
//   • "auto_post": try to post it via the platform API (only works where the app has approved access);
//     on failure it stays queued and the member is told to copy & paste instead.
//   • "posted":    the member copied it and posted it themselves → mark done (this is the reliable,
//     always-compliant path — the member posts to their own account by hand).
//   • "dismiss":   skip this one.
// Body: { post_id, action }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { post_id, action } = await req.json().catch(() => ({}));
    if (!post_id || !["auto_post", "posted", "dismiss"].includes(action)) {
      return Response.json({ error: 'post_id and action ("auto_post"|"posted"|"dismiss") required' }, { status: 400 });
    }
    const post = await db.get("SocialMediaPost", String(post_id)).catch(() => null) as any;
    if (!post) return Response.json({ error: "Post not found." }, { status: 404 });
    if (post.user_id !== user.id) return Response.json({ error: "That post isn't yours." }, { status: 403 });
    const now = new Date().toISOString();

    if (action === "dismiss") {
      await db.update("SocialMediaPost", String(post_id), { status: "dismissed", dismissed_at: now }).catch(() => null);
      return Response.json({ ok: true, status: "dismissed" });
    }

    if (action === "posted") {
      // Member posted it themselves (copy & paste). Reliable + compliant.
      await db.update("SocialMediaPost", String(post_id), { status: "posted", posted_at: now, posted_by: "member_manual" }).catch(() => null);
      return Response.json({ ok: true, status: "posted", credited: true });
    }

    // action === "auto_post": best-effort via the platform poster; on any failure, fall back to copy/paste.
    const r = await base44.functions.invoke("postAdToSocialMedia", { adId: String(post_id), content: post.content, selectedPlatforms: [post.platform] }).catch(() => null) as any;
    const ok = !!(r?.data && !r.data.error);
    if (ok) {
      await db.update("SocialMediaPost", String(post_id), { status: "posted", posted_at: now, posted_by: "auto" }).catch(() => null);
      return Response.json({ ok: true, status: "posted", auto_posted: true });
    }
    return Response.json({ ok: false, auto_posted: false, fallback_copy: true, message: "Auto-post isn't available for this account yet — copy the text and paste it into your app, then tap “I posted it.”" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
