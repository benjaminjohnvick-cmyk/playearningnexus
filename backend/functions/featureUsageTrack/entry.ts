import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordFeatureUse, featurePmfEnabled } from "../../sdk/feature-pmf.ts";

// featureUsageTrack — records ONE feature use for the current user, feeding the PMF scoreboard's adoption /
// engagement / retention signals. A feature's front-end (or another backend function) calls this when the user
// actually uses the feature. The founding flag is read from the user so the scoreboard can segment the founding
// PMF panel from the general population — a MEASURED privilege, never a quota. Best-effort; never blocks.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!featurePmfEnabled()) return Response.json({ ok: true, enabled: false, note: "PMF tracking off." });

    const body = await req.json().catch(() => ({}));
    const featureKey = String(body.feature_key || "").trim();
    if (!featureKey) return Response.json({ error: "feature_key required" }, { status: 400 });

    const u = user as Record<string, unknown>;
    const founding = !!(u.is_founding_advertiser || u.founding || u.is_founder || u.founding_advertiser);
    const tier = Number(body.tier) || (Number(u.advertiser_tier) || null);

    await recordFeatureUse({
      feature_key: featureKey,
      user_id: String(u.id ?? ""),
      tier: tier as number | null,
      founding,
      weight: Math.max(0, Number(body.weight) || 1),
      meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    });
    return Response.json({ ok: true, recorded: true, feature_key: featureKey, founding });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
