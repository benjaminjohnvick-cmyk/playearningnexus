import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { Core } from "../../sdk/integrations.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { getNumber, getBool, getString } from "../../sdk/settings.ts";
import { withAdDisclosure } from "../../sdk/disclosure.ts";
import { hasDoubled, socialPostingOrderTarget } from "../../sdk/premium-ppc.ts";

// premiumPPCAutoAdvertise (INTERNAL/ADMIN, scheduled) — the AI advertising engine for the PPC network.
// For each PAYING advertiser that hasn't yet DOUBLED their investment (received ≥ $10k in orders), the
// AI writes an ad for their product and QUEUES it as a #ad-disclosed SocialMediaPost on the accounts of
// PPC survey-members who CONSENTED to social advertising as a condition of their up-front advance.
// Free to the advertiser until they've doubled; after that they stop (their earnings become points
// spendable on anything via the site). Respects the social_posting kill switch and a per-run cap.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await isEnabled("social_posting").catch(() => true))) {
      return Response.json({ success: true, skipped: "social_posting flag off" });
    }
    const base44 = createClientFromRequest(req);
    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));

    const maxPostsPerRun = Math.max(1, await getNumber("PREMIUM_ADS_MAX_POSTS_PER_RUN", 200));
    const maxUsersPerAdvertiser = Math.max(1, await getNumber("PREMIUM_ADS_USERS_PER_ADVERTISER", 25));
    const target = socialPostingOrderTarget();
    // ToS/spam guardrail: queue for member approval by default (never silent-auto by default).
    const postStatus = (await getBool("PREMIUM_ADS_REQUIRE_APPROVAL", true)) ? "pending_approval" : "scheduled";

    // Paying advertisers still under the doubling cap.
    const advertisers = (await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true }, "-created_date", 2000).catch(() => []) as any[])
      .filter((a) => !hasDoubled(Number(a.ppc_orders_value_delivered ?? 0)));

    // Consenting survey-members and their connected social accounts.
    const optedIn = await base44.asServiceRole.entities.User.filter({ ppc_social_ads_opt_in: true }, "-created_date", 5000).catch(() => []) as any[];
    const optedIds = new Set(optedIn.map((u) => u.id));

    let posts = 0; const perAdvertiser: Record<string, number> = {};
    outer:
    for (const adv of advertisers) {
      // Compose the ad once per advertiser.
      const product = String(adv.business_name || adv.company || adv.full_name || "our featured partner");
      let copy = `Check out ${product} on GamerGain — shop it (and anything else) with your points.`;
      if (hasLLM) {
        try {
          const out = await Core.InvokeLLM({
            prompt: `Write ONE short, upbeat social post (max 240 chars, 1-2 emojis) advertising "${product}" to a general audience, ending with a soft call to action. No hashtags — a disclosure is appended automatically. Product/notes: ${String(adv.business_description || adv.product_notes || "").slice(0, 400)}`,
          }) as string;
          if (typeof out === "string" && out.trim()) copy = out.trim().slice(0, 260);
        } catch { /* keep template */ }
      }
      const content = withAdDisclosure(copy);

      // Queue it on consenting members' connected accounts.
      const conns = await base44.asServiceRole.entities.SocialMediaConnection.filter({}, "-created_date", 5000).catch(() => []) as any[];
      let usedForThisAdv = 0;
      for (const conn of conns) {
        if (posts >= maxPostsPerRun) break outer;
        if (usedForThisAdv >= maxUsersPerAdvertiser) break;
        if (!optedIds.has(conn.user_id)) continue;                 // only consenting members
        if (conn.user_id === adv.id) continue;                     // don't post the advertiser's own ad to themselves
        await base44.asServiceRole.entities.SocialMediaPost.create({
          user_id: conn.user_id, platform: conn.platform, content,
          status: postStatus, auto_posted: true, post_type: "premium_ppc_ad",
          ppc_advertiser_id: adv.id, disclosed: true, created_at: new Date().toISOString(),
        }).catch(() => null);
        posts++; usedForThisAdv++;
      }
      perAdvertiser[adv.id] = usedForThisAdv;
    }

    // ALSO post a daily ad for YOUR OWN business to every consenting member's connected accounts.
    let ownPosts = 0;
    if (await getBool("PREMIUM_OWN_AD_ENABLED", true)) {
      const bizName = await getString("PREMIUM_OWN_AD_BUSINESS", "GamerGain");
      let ownCopy = await getString("PREMIUM_OWN_AD_TEXT", "");
      if (!ownCopy && hasLLM) {
        try {
          const out = await Core.InvokeLLM({ prompt: `Write ONE short, upbeat social post (max 220 chars, 1-2 emojis) promoting "${bizName}". No hashtags — a disclosure is appended automatically.` }) as string;
          if (typeof out === "string" && out.trim()) ownCopy = out.trim().slice(0, 240);
        } catch { /* fall through to template */ }
      }
      if (!ownCopy) ownCopy = `Discover ${bizName} — earn, play, and shop, all in one place.`;
      const ownContent = withAdDisclosure(ownCopy);
      const conns = await base44.asServiceRole.entities.SocialMediaConnection.filter({}, "-created_date", 5000).catch(() => []) as any[];
      for (const conn of conns) {
        if (ownPosts >= maxPostsPerRun) break;
        if (!optedIds.has(conn.user_id)) continue;
        await base44.asServiceRole.entities.SocialMediaPost.create({
          user_id: conn.user_id, platform: conn.platform, content: ownContent,
          status: postStatus, auto_posted: true, post_type: "platform_own_ad", disclosed: true, created_at: new Date().toISOString(),
        }).catch(() => null);
        ownPosts++;
      }
    }

    return Response.json({ success: true, advertisers: advertisers.length, consenting_members: optedIds.size, posts_queued: posts, own_business_posts: ownPosts, per_advertiser: perAdvertiser, doubling_target_usd: target, post_status: postStatus });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
