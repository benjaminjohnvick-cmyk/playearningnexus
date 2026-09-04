import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { normalizeCosmetic } from "../../sdk/cosmetics.ts";

// adminCosmeticUpsert (admin) — curate the closed-loop cosmetics catalog. Create or update a CosmeticItem by
// `key` (upsert), set its price in Site Cash / rarity / image / active flag, or deactivate it. Admin-gated.
// Never touches user funds or ownership — catalog metadata only.
//   { key, name?, type?, price_usd?, rarity?, image_url?, description?, active? } → { ok, item } | { error }
const TYPES = new Set(["avatar_frame", "profile_theme", "badge_flair", "nameplate", "profile_effect"]);
const RARITIES = new Set(["common", "rare", "epic", "legendary"]);

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const key = String(body.key || "").trim();
    if (!key) return Response.json({ error: "key required" }, { status: 400 });
    if (body.type && !TYPES.has(String(body.type))) return Response.json({ error: `type must be one of ${[...TYPES].join(", ")}` }, { status: 400 });
    if (body.rarity && !RARITIES.has(String(body.rarity))) return Response.json({ error: `rarity must be one of ${[...RARITIES].join(", ")}` }, { status: 400 });

    const existing = await db.filter("CosmeticItem", { key }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const patch: Record<string, unknown> = { key };
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.type !== undefined) patch.type = String(body.type);
    if (body.price_usd !== undefined) patch.price_usd = Math.max(0, Number(body.price_usd) || 0);
    if (body.rarity !== undefined) patch.rarity = String(body.rarity);
    if (body.image_url !== undefined) patch.image_url = String(body.image_url);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.active !== undefined) patch.active = body.active !== false;

    let row: Record<string, unknown> | null;
    if (existing && existing[0]) {
      row = await db.update("CosmeticItem", String(existing[0].id), patch);
    } else {
      row = await db.create("CosmeticItem", {
        type: "avatar_frame", price_usd: 0, rarity: "common", active: true, ...patch,
      });
    }

    return Response.json({ ok: true, item: row ? normalizeCosmetic(row) : null });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
