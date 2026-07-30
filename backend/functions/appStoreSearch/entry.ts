import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { appCategoryForSub } from "../../sdk/app-taxonomy.ts";
import { db } from "../../sdk/db.ts";

// appStoreSearch (authenticated) — search ANY app or game by free-text query, optionally narrowed by
// category and/or subsection. Searches the Games catalog plus app-type marketplace listings, and
// returns a merged, relevance-ish result set. This powers the App Store search bar.
//   Body: { query?, category?, subcategory?, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const q = String(b.query || "").trim().toLowerCase();
    const category = String(b.category || "").trim().toLowerCase();
    const subcategory = String(b.subcategory || "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(b.limit) || 60));
    // If a subsection was given without a category, resolve its parent for broader matching.
    const parentCat = subcategory ? (appCategoryForSub(subcategory) || "").toLowerCase() : "";

    const matchesText = (o: Record<string, unknown>) => {
      if (!q) return true;
      const hay = `${o.title ?? o.name ?? ""} ${o.description ?? ""} ${o.developer ?? o.publisher ?? ""} ${o.category ?? ""} ${o.subcategory ?? ""}`.toLowerCase();
      return hay.includes(q);
    };
    const matchesCat = (o: Record<string, unknown>) => {
      const oc = String(o.category ?? "").toLowerCase();
      const os = String(o.subcategory ?? o.genre ?? "").toLowerCase();
      if (subcategory) return os === subcategory || oc === subcategory || oc === parentCat || os.includes(subcategory);
      if (category) return oc === category || os.includes(category);
      return true;
    };

    // 1) Games catalog.
    const games = await db.filter("Game", { marketplace_approved: true }, "-created_date", 4000).catch(() => []) as Record<string, unknown>[];
    const gameHits = (games || []).filter((g) => matchesText(g) && matchesCat(g)).map((g) => ({
      kind: "game", id: g.id, title: g.title ?? g.name ?? "", developer: g.developer ?? g.publisher ?? null,
      category: g.category ?? "Games", subcategory: g.subcategory ?? g.genre ?? null,
      image_url: g.image_url ?? g.icon_url ?? g.cover_url ?? null, rating: g.rating ?? null,
      price_points: g.price_points ?? null, price_usd: g.price_usd ?? null,
    }));

    // 2) App-type marketplace listings (Digital Products / Mobile Apps, or listings marked as apps).
    const listings = await db.filter("MarketplaceListing", { status: "active" }, "-created_date", 4000).catch(() => []) as Record<string, unknown>[];
    const isApp = (l: Record<string, unknown>) => /app|software|digital/i.test(String(l.category ?? "")) || String(l.product_type ?? "").toLowerCase() === "app";
    const appHits = (listings || []).filter((l) => isApp(l) && matchesText(l) && matchesCat(l)).map((l) => ({
      kind: "app", id: l.id, title: l.title ?? l.name ?? "", developer: l.seller_name ?? null,
      category: l.category ?? "Apps", subcategory: l.subcategory ?? null,
      image_url: l.image_url ?? l.product_image_url ?? null, rating: l.rating ?? null,
      price_points: l.price_points ?? null, price_usd: l.price_usd ?? null,
    }));

    const results = [...gameHits, ...appHits].slice(0, limit);
    return Response.json({
      query: b.query || "", category: b.category || null, subcategory: b.subcategory || null,
      total: results.length, games: gameHits.length, apps: appHits.length, results,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
