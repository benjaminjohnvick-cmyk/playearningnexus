import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { cosmeticsEnabled } from "../../sdk/cosmetics.ts";

// equipCosmetic (authenticated) — equip (or unequip) a cosmetic the caller OWNS. One equipped item per type
// (equipping a new avatar_frame unequips the old one). No money moves here — purely a display toggle over the
// caller's own UserCosmetic rows.
//   { cosmetic_key, equip? = true } → { ok, equipped } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!cosmeticsEnabled()) return Response.json({ error: "The cosmetics store is not available right now." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const key = String(body.cosmetic_key || "").trim();
    const equip = body.equip !== false; // default true
    if (!key) return Response.json({ error: "cosmetic_key required" }, { status: 400 });

    const uid = String(user.id);
    const mine = await db.filter("UserCosmetic", { user_id: uid, cosmetic_key: key }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const row = mine && mine[0];
    if (!row) return Response.json({ error: "You don't own that cosmetic." }, { status: 404 });

    const type = String(row.cosmetic_type || "");

    if (equip) {
      // Unequip any other item of the same type first (one active per slot).
      const sameType = await db.filter("UserCosmetic", { user_id: uid, cosmetic_type: type, equipped: true }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      for (const other of sameType || []) {
        if (String(other.cosmetic_key) !== key) await db.update("UserCosmetic", String(other.id), { equipped: false }).catch(() => null);
      }
      await db.update("UserCosmetic", String(row.id), { equipped: true }).catch(() => null);
    } else {
      await db.update("UserCosmetic", String(row.id), { equipped: false }).catch(() => null);
    }

    return Response.json({ ok: true, equipped: equip ? key : null, cosmetic_type: type });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
