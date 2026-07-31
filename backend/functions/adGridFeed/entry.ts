import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adgridThumbnailsPerSession, adgridThumbnailPrice, INTEREST_QUESTION } from "../../sdk/adgrid.ts";

// adGridFeed (authenticated) — the daily grid of thumbnails for a premium user: N active AdGrid ads the user
// hasn't already answered today and hasn't marked "not interested". Each carries its 2 questions + the
// permanent Option E interest question.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const n = adgridThumbnailsPerSession();

    // Suppress products the user marked "not interested", and ones already answered today.
    const priorResponses = await db.filter("AdGridResponse", { user_id: user.id }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
    const today = new Date().toISOString().slice(0, 10);
    const notInterested = new Set<string>();
    const answeredToday = new Set<string>();
    for (const r of (priorResponses || [])) {
      if (r.interested === false) notInterested.add(String(r.ad_id));
      if (String(r.day) === today) answeredToday.add(String(r.ad_id));
    }

    const ads = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    const eligible = (ads || []).filter((a) => !notInterested.has(String(a.id)) && !answeredToday.has(String(a.id)));

    const thumbnails = eligible.slice(0, n).map((a) => ({
      ad_id: a.id,
      product_name: a.product_name,
      image_url: a.image_url || null,
      questions: [
        ...((a.questions as any[]) || []).map((q) => ({ q: q.q, options: q.options })),
        { q: INTEREST_QUESTION, options: ["Yes", "No"], is_interest: true },   // permanent Option E
      ],
    }));

    return Response.json({
      thumbnails,
      thumbnails_per_session: n,
      price_per_thumbnail: adgridThumbnailPrice(),
      session_goal_usd: Math.round(n * adgridThumbnailPrice() * 100) / 100,
      available: eligible.length,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
