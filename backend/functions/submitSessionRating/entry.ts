import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// submitSessionRating (authenticated user) — end-of-session rating: one rating meant for the app
// store and one internal site rating (each 1–5), plus optional comments. Both default to 5 in the UI.
// Body: { app_store_rating, site_rating, comments?, session_id? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const clampStar = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v) || 5)));
    const appStore = clampStar(body.app_store_rating);
    const site = clampStar(body.site_rating);

    const rating = await base44.asServiceRole.entities.SessionRating.create({
      user_id: user.id,
      user_email: user.email,
      app_store_rating: appStore,
      site_rating: site,
      comments: (body.comments ?? "").toString().slice(0, 4000) || null,
      session_id: body.session_id ?? null,
      created_at: new Date().toISOString(),
    });

    // If the app-store rating is high, gently prompt for a public store review (flag for the UI).
    return Response.json({ success: true, id: (rating as any).id, prompt_app_store_review: appStore >= 4 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
