import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import { withAdDisclosure } from "../../sdk/disclosure.ts";
import { socialPostContribution } from "../../sdk/social-amplification.ts";

// sessionSocialAnnounce — puts a LIVE hosted session onto members' SOCIAL FEEDS. Reuses the existing
// social-amplification path (opted-in members, #ad-disclosed, one-tap post) to distribute a "🔴 LIVE now"
// announcement carrying a WATCH link, so an advertiser's live stream reaches members' social audiences and the
// estimated reach counts toward the advertiser's delivered value / ROI. Only advertised products stream, so the
// announced product is always an advertiser's. Gated by SESSION_HOSTING_ENABLED + HOSTING_SOCIAL_SIMULCAST_ENABLED
// (counsel-gated). Host or admin triggers it.
//   POST { room, base_url?, limit? } → { ok, queued, projected_reach, projected_impressions, watch_url }
export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false });
    if (!snapBool("HOSTING_SOCIAL_SIMULCAST_ENABLED", false)) {
      return Response.json({ ok: true, enabled: true, social_enabled: false, note: "HOSTING_SOCIAL_SIMULCAST_ENABLED is off (counsel-gated)." });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const room = String(body.room || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    const sess = (await base44.asServiceRole.entities.GameSession.filter({ session_id: room }).catch(() => []))[0];
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });
    const isHost = String(sess.host_player_id ?? "") === String(user.id) || String(sess.started_by ?? "") === (user.email ?? user.id);
    if (!isHost && user.role !== "admin") return Response.json({ error: "Only the host or an admin can announce this session." }, { status: 403 });

    // Build the watch link + announcement copy from the featured (advertised) product.
    const base = String(body.base_url || snapString("PUBLIC_APP_URL", "") || "").replace(/\/+$/, "");
    const watchUrl = `${base}/WatchSession?room=${encodeURIComponent(room)}`;
    const fp = (sess.featured_product ?? {}) as Record<string, unknown>;
    const productName = String(fp.name || "great deals");
    const advertiserId = String(fp.advertiser_user_id || sess.host_player_id || user.id);
    const content = withAdDisclosure(`🔴 LIVE now: ${productName} — watch & shop live: ${watchUrl}`);

    // Distribute to opted-in members with social reach (bounded batch), same as socialAmplifyDistribute.
    const limit = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const members = (await base44.asServiceRole.entities.User
      .filter({ ppc_social_ads_opt_in: true }, "-created_date", limit)
      // deno-lint-ignore no-explicit-any
      .then((r: any) => r || []).catch(() => [])) as Record<string, unknown>[];

    let queued = 0, projectedReach = 0, projectedImpressions = 0;
    for (const m of members) {
      const reach = Math.max(0, Number(m.social_reach) || 0);
      if (reach <= 0) continue;
      const c = socialPostContribution(reach);
      await db.create("SocialMediaPost", {
        advertiser_id: advertiserId, tier: "tier1", user_id: m.id, content,
        kind: "livestream_announce", session_id: room, watch_url: watchUrl,
        status: "queued", reach: c.reach, projected_impressions: c.est_impressions,
        created_at: new Date().toISOString(),
      }).catch(() => null);
      queued++; projectedReach += c.reach; projectedImpressions += c.est_impressions;
    }

    return Response.json({
      ok: true, enabled: true, social_enabled: true, room, watch_url: watchUrl,
      queued, projected_reach: projectedReach, projected_impressions: projectedImpressions,
      note: "Live session queued to consenting members' social feeds (#ad). Members one-tap post; reach counts toward the advertiser's delivered value.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
