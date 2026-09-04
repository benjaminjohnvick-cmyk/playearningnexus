import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { cosmeticsEnabled, DEFAULT_COSMETICS, normalizeCosmetic } from "../../sdk/cosmetics.ts";

// cosmeticsCatalog (authenticated) — the closed-loop virtual-goods store. Returns the catalog (admin-curated
// CosmeticItem rows override/extend the starter DEFAULT_COSMETICS), which items the caller already owns, which
// is equipped per type, and the caller's spendable Site-Cash (current_balance = non-cashable store credit).
// Read-only. Gated: if the store is off, returns an empty, disabled catalog rather than erroring.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!cosmeticsEnabled()) {
      return Response.json({ enabled: false, items: [], owned: [], equipped: {}, balance_usd: 0 });
    }

    // Curated rows (if any) take precedence over the starter defaults, keyed by `key`.
    const curated = await db.list("CosmeticItem", "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    const byKey = new Map<string, ReturnType<typeof normalizeCosmetic>>();
    for (const d of DEFAULT_COSMETICS) byKey.set(d.key, normalizeCosmetic(d));
    for (const row of curated || []) {
      const n = normalizeCosmetic(row);
      if (n.key) byKey.set(n.key, n);
    }
    const items = [...byKey.values()].filter((i) => i.active);

    const mine = await db.filter("UserCosmetic", { user_id: String(user.id) }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];
    const owned = (mine || []).map((r) => String(r.cosmetic_key || ""));
    const equipped: Record<string, string> = {};
    for (const r of mine || []) {
      if (r.equipped === true) equipped[String(r.cosmetic_type || "")] = String(r.cosmetic_key || "");
    }

    const balance_usd = Math.max(0, Number((user as Record<string, unknown>).current_balance) || 0);

    return Response.json({ enabled: true, items, owned, equipped, balance_usd });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
