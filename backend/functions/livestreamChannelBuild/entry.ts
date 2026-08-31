import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { rankTopSellers, type OrderLike } from "../../sdk/social-shop.ts";
import { buildChannelPlan, renderWorklist, commercialBrief, type FeaturedItem } from "../../sdk/livestream-channels.ts";
import { generateProductImageUrl } from "../../sdk/image-gen.ts";
import { renderConfig, renderVideoCall } from "../../sdk/video-render.ts";
import { AD_DISCLOSURE } from "../../sdk/disclosure.ts";

// livestreamChannelBuild — builds/refreshes the Omni-Channel Livestream shopping category. Takes the current top
// sellers, groups them into subcategory "channels" (mirroring the existing shopping sections), and for each
// featured product generates an AI image and — when OMNI_CHANNEL_COMMERCIALS is on — a short AI commercial on the
// Abacus engine (disclosed AI + #ad, no real person, no guaranteed results). Bounded per run so cost stays
// predictable. Stores channel tiles as CatalogCategory (kind "omni_livestream") + LivestreamFeature rows.
// Gated behind OMNI_CHANNEL_LIVESTREAM_ENABLED. Admin / scheduled.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const enabled = snapBool("OMNI_CHANNEL_LIVESTREAM_ENABLED", false);
    if (!enabled) return Response.json({ ok: true, enabled: false, note: "Omni-Channel Livestream is off (OMNI_CHANNEL_LIVESTREAM_ENABLED) — nothing built." });

    const body = await req.json().catch(() => ({}));
    const perChannel = Math.max(1, Number(body?.per_channel) || (await getNumber("OMNI_CHANNEL_FEATURED_PER_SUB", 3)));
    const cap = Math.max(1, Number(body?.per_run_cap) || (await getNumber("OMNI_CHANNEL_PER_RUN_CAP", 10)));
    const wantCommercials = body?.commercials != null ? !!body.commercials : snapBool("OMNI_CHANNEL_COMMERCIALS", false);
    const windowDays = Math.max(1, await getNumber("SOCIAL_SHOP_TOP_WINDOW_DAYS", 7));

    // Top sellers over the window.
    const sinceISO = new Date(Date.now() - windowDays * 24 * 3600_000).toISOString();
    const orders = await db.filter("Order", { created_date: { $gte: sinceISO } }, "-created_date", 5000).catch(() => []) as OrderLike[];
    const top = rankTopSellers(orders, 100);

    // Resolve each top item's subcategory from its Product record (best-effort), else "Trending".
    const featured: FeaturedItem[] = [];
    for (const t of top) {
      let sub = "Trending";
      const [prod] = await db.filter("Product", { name: t.item_name }, undefined, 1).catch(() => []) as Record<string, unknown>[];
      if (prod) sub = String(prod.subcategory ?? prod.category ?? "Trending") || "Trending";
      featured.push({ item_name: t.item_name, subcategory: sub, seller_id: t.seller_id, units: t.units, revenue_usd: t.revenue_usd });
    }

    const channels = buildChannelPlan(featured, perChannel);
    const work = renderWorklist(channels, cap);

    const rc = renderConfig();
    let images = 0, commercials = 0;
    for (const w of work) {
      // Product image.
      const imgUrl = await generateProductImageUrl(w.item_name, `${w.item_name} — ${w.channel} live channel`, w.channel).catch(() => null);
      if (imgUrl) images++;

      // Optional AI commercial (Abacus), with disclosure baked in.
      let videoUrl: string | null = null, jobId: string | null = null;
      let disclosure: Record<string, unknown> | null = null;
      if (wantCommercials) {
        const brief = commercialBrief(w.item_name, w.channel, AD_DISCLOSURE);
        disclosure = brief.disclosure;
        const rr = await renderVideoCall(rc, brief.prompt).catch(() => ({ ok: false } as { ok: boolean; video_url?: string; job_id?: string }));
        if (rr.ok) { videoUrl = rr.video_url ?? null; jobId = rr.job_id ?? null; commercials++; }
      }

      // Upsert the channel tile (CatalogCategory, kind omni_livestream).
      const [chRow] = await db.filter("CatalogCategory", { name: w.channel, kind: "omni_livestream" }, undefined, 1).catch(() => []) as Record<string, unknown>[];
      if (!chRow) await db.create("CatalogCategory", { name: w.channel, level: 2, kind: "omni_livestream", parent: "Omni-Channel Livestream", image_url: imgUrl, created_at: new Date().toISOString() }).catch(() => null);
      else if (imgUrl && !chRow.image_url) await db.update("CatalogCategory", String(chRow.id), { image_url: imgUrl }).catch(() => null);

      // Store/refresh the featured-product record with its media.
      const [feat] = await db.filter("LivestreamFeature", { channel: w.channel, item_name: w.item_name }, undefined, 1).catch(() => []) as Record<string, unknown>[];
      const payload = { channel: w.channel, item_name: w.item_name, image_url: imgUrl, video_url: videoUrl, render_job_id: jobId, disclosure, refreshed_at: new Date().toISOString() };
      if (feat?.id) await db.update("LivestreamFeature", String(feat.id), payload).catch(() => null);
      else await db.create("LivestreamFeature", { ...payload, created_at: new Date().toISOString() }).catch(() => null);
    }

    // Ensure the top-level category row exists.
    const [topRow] = await db.filter("CatalogCategory", { name: "Omni-Channel Livestream", kind: "omni_livestream" }, undefined, 1).catch(() => []) as Record<string, unknown>[];
    if (!topRow) await db.create("CatalogCategory", { name: "Omni-Channel Livestream", level: 1, kind: "omni_livestream", created_at: new Date().toISOString() }).catch(() => null);

    return Response.json({
      ok: true, enabled, channels: channels.length, featured_rendered: work.length, images, commercials,
      note: `Built ${channels.length} channel(s); rendered ${images} image(s)` + (wantCommercials ? ` and ${commercials} AI commercial(s) (disclosed ${AD_DISCLOSURE})` : " (commercials off)") + ".",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
