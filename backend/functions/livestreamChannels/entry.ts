import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";

// livestreamChannels — read endpoint for the Omni-Channel Livestream shopping section. Returns the category, its
// channels (subcategories that mirror the shopping sections), and the featured products with their AI image /
// commercial, so the client can render it alongside the other shopping sections. Read-only; authenticated.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!snapBool("OMNI_CHANNEL_LIVESTREAM_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, category: null, channels: [], note: "Omni-Channel Livestream is off." });
    }

    const body = await req.json().catch(() => ({}));
    const onlyChannel = String(body?.channel || "").trim();

    // Channel tiles (subcategories) + featured products.
    const tiles = await db.filter("CatalogCategory", { kind: "omni_livestream", level: 2 }, "name", 500).catch(() => []) as Record<string, unknown>[];
    const featQuery: Record<string, unknown> = onlyChannel ? { channel: onlyChannel } : {};
    const feats = await db.filter("LivestreamFeature", featQuery, "-refreshed_at", 1000).catch(() => []) as Record<string, unknown>[];

    const byChannel: Record<string, Array<Record<string, unknown>>> = {};
    for (const f of feats) {
      const ch = String(f.channel ?? "Trending");
      (byChannel[ch] ??= []).push({ item_name: f.item_name, image_url: f.image_url ?? null, video_url: f.video_url ?? null, disclosure: f.disclosure ?? null });
    }

    const channels = tiles
      .filter((t) => !onlyChannel || String(t.name) === onlyChannel)
      .map((t) => ({ channel: String(t.name), image_url: t.image_url ?? null, products: byChannel[String(t.name)] ?? [] }));

    return Response.json({
      ok: true, enabled: true,
      category: "Omni-Channel Livestream",
      channels,
      note: channels.length ? `${channels.length} live channel(s).` : "No channels built yet — run livestreamChannelBuild.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
