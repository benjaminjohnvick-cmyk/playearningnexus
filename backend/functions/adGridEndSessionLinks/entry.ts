import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// adGridEndSessionLinks (authenticated) — at logout / session end, return the product links from the
// thumbnails the user engaged today, for the "want to visit these products?" prompt. Only products they were
// interested in (Option E != no) are surfaced.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const day = new Date().toISOString().slice(0, 10);
    const rows = await db.filter("AdGridResponse", { user_id: user.id, day }, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
    const seen = new Set<string>();
    const links: { ad_id: string; product_name: string; product_url: string | null }[] = [];
    for (const r of (rows || [])) {
      if (r.interested === false) continue;
      const id = String(r.ad_id);
      if (seen.has(id)) continue;
      seen.add(id);
      links.push({ ad_id: id, product_name: String(r.product_name || "Product"), product_url: (r.product_url as string) || null });
    }
    return Response.json({ day, links, count: links.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
