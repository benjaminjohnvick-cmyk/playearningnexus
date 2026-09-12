// interstitial-ad.ts — shared ad selector for the full-screen interstitial placements (between-survey AND
// in-app). Picks ONE ad from your OWN inventory with the same priority both placements use:
//   1) Founding advertisers' active creatives (up to their yearly allotment),
//   2) Paying PPC-grid advertisers' active creatives,
//   3) Earned / no-upfront advertisers whose free advertising is currently delivering,
//   4) Residual make-good delivery (an advertiser owed a free top-up), then
//   5) a house ad.
// Keeping this in one place means the two placements can never drift apart. The CALLER records the
// impression (placement differs) and meters founding/make-good owners.
import { foundingInterstitialPriority, activeFoundingAdOwners } from "./founding-advertiser.ts";
import { activeEarnedAdOwners } from "./earned-advertiser.ts";
import { activeMakeGoodOwners } from "./delivery-guarantee.ts";
import { houseCrossSellEnabled, pickHouseCrossSell } from "./cross-promo.ts";
import { resolveAdMedia } from "./ad-media.ts";
import { normalizeTargeting, userMatchesTargeting } from "./ad-targeting.ts";
import { loadTargetingModel, rankByLearnedAffinity } from "./ad-targeting-ai.ts";
import { cached } from "./ttl-cache.ts";
import { snapNumber } from "./settings.ts";

// Burst control: an ad break fires for EVERY viewer of a live session within a couple of seconds, and each pick
// reads the same SHARED, slow-changing inventory (active creatives, owner sets, the targeting model). We serve
// those from a short-TTL, single-flight cache so a 100k-viewer break collapses to ONE read per isolate per
// window instead of 100k. The per-USER work (targeting match + learned ranking) still runs every call, on the
// cached in-memory array — so who sees which ad is unchanged; only the redundant DB reads are removed.
const burstCacheMs = () => Math.max(0, Math.round(snapNumber("AD_BURST_CACHE_MS", 15000)));
const activeAdsMax = () => Math.max(1, Math.round(snapNumber("ADS_ACTIVE_MAX", 5000)));

export type PickedInterstitial = {
  ad: Record<string, unknown>;
  foundingOwnerId: string | null;
  ppcAdvertiser: boolean;
  earnedAdvertiser: boolean;
  makegoodOwnerId: string | null;
};

// deno-lint-ignore no-explicit-any
export async function pickInterstitialAd(base44: any, db: any, opts?: { ppcPriority?: boolean; houseTitle?: string; houseUrl?: string; adfreeOnly?: boolean; user?: Record<string, unknown> }): Promise<PickedInterstitial> {
  const ppcPriority = opts?.ppcPriority ?? true;
  const ttl = burstCacheMs();

  // Active-ad inventory — the heaviest shared read. Bounded by a cap and served from the burst cache. The
  // returned array is treated as READ-ONLY (every filter below copies), so sharing it across callers is safe.
  const allActive = await cached("interstitial:active", ttl, () =>
    base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }, "-created_date", activeAdsMax())
      // deno-lint-ignore no-explicit-any
      .then((r: any) => (r || []) as Record<string, unknown>[]).catch(() => [] as Record<string, unknown>[]),
  );
  let slots = allActive as Record<string, unknown>[];

  // adfreeOnly: the premium "extra minute" placement includes every active creative BY DEFAULT (part of the
  // offer); an advertiser is in unless they explicitly opted out (adfree_minute_optout === true). If every
  // eligible creative has opted out, falls through to the house ad below.
  if (opts?.adfreeOnly) slots = (slots || []).filter((s) => s.adfree_minute_optout !== true);

  // Cohort targeting: keep only creatives whose targeting matches THIS user's Know-Your-Customer answers.
  // Untargeted creatives always pass; if nothing matches, the house fallback below still fills the slot.
  const kycAnswers = (opts?.user?.kyc_answers as Record<string, unknown> | undefined) ?? null;
  slots = (slots || []).filter((s) => userMatchesTargeting(normalizeTargeting(s.targeting), kycAnswers, opts?.user as Record<string, unknown> | undefined));

  // Self-learning relevance bias: order the matching slots by learned cohort affinity for this user, so each
  // priority tier's first-match picks the most relevant creative. No-op when the AI layer is off or untrained.
  // The model is a shared singleton — served from the burst cache so a break doesn't reload it per viewer.
  const learnedModel = await cached("interstitial:model", ttl, () => loadTargetingModel(db).catch(() => null));
  slots = rankByLearnedAffinity(slots, learnedModel, kycAnswers);

  let pick = (slots || [])[0] || null;
  let foundingOwnerId: string | null = null;
  let ppcAdvertiser = false;

  // 1) Founding advertisers first. Owner set is shared → burst-cached.
  if (foundingInterstitialPriority() && (slots || []).length) {
    const owners = await cached("interstitial:founding", ttl, () => activeFoundingAdOwners(db).catch(() => new Set<string>()));
    const fpick = (slots || []).find((s) => owners.has(String(s.created_by)));
    if (fpick) { pick = fpick; foundingOwnerId = String(fpick.created_by); }
  }

  // 2) Paying PPC-grid advertisers. The paying set is computed over ALL active-ad owners (a slot's owner is
  //    paying or not regardless of which viewer sees it), so it's SHARED and burst-cached — one bounded id-$in
  //    lookup per isolate per window, never the whole paying-advertiser population, never once per viewer.
  if (!foundingOwnerId && ppcPriority && (slots || []).length) {
    const paying = await cached("interstitial:paying", ttl, async () => {
      const ownerIds = Array.from(new Set(
        (allActive || []).flatMap((s) => [String(s.advertiser_user_id ?? ""), String(s.created_by ?? "")]).filter(Boolean),
      ));
      if (!ownerIds.length) return new Set<string>();
      const payingRows = await base44.asServiceRole.entities.User
        .filter({ id: { $in: ownerIds }, ppc_grid_active: true })
        // deno-lint-ignore no-explicit-any
        .then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
      return new Set((payingRows || []).map((a) => String(a.id)));
    });
    const ppick = (slots || []).find((s) => paying.has(String(s.advertiser_user_id)) || paying.has(String(s.created_by)));
    if (ppick) { pick = ppick; ppcAdvertiser = true; }
  }

  // 3) Earned / free advertisers currently delivering. Owner set is shared (keyed by day) → burst-cached.
  let earnedAdvertiser = false;
  if (!foundingOwnerId && !ppcAdvertiser && (slots || []).length) {
    const day = new Date().toISOString().slice(0, 10);
    const earnedOwners = await cached("interstitial:earned:" + day, ttl, () => activeEarnedAdOwners(db, day).catch(() => new Set<string>()));
    if (earnedOwners.size) {
      const epick = (slots || []).find((s) => earnedOwners.has(String(s.advertiser_user_id)) || earnedOwners.has(String(s.created_by)));
      if (epick) { pick = epick; earnedAdvertiser = true; }
    }
  }

  // 4) Residual make-good delivery.
  let makegoodOwnerId: string | null = null;
  if (!foundingOwnerId && !ppcAdvertiser && !earnedAdvertiser && (slots || []).length) {
    const mgOwners = await cached("interstitial:makegood", ttl, () => activeMakeGoodOwners(db).catch(() => new Set<string>()));
    if (mgOwners.size) {
      const mpick = (slots || []).find((s) => mgOwners.has(String(s.advertiser_user_id)) || mgOwners.has(String(s.created_by)));
      if (mpick) { pick = mpick; makegoodOwnerId = String(mpick.advertiser_user_id ?? mpick.created_by); }
    }
  }

  // 5) House fallback. When nothing paid filled the slot, prefer a HOUSE CROSS-SELL creative (refer / Premium /
  //    spend) over a blank house filler, so unsold inventory still markets the flywheel (§4.2). Bills nothing
  //    (its ad_id matches no advertiser). Falls back to the plain house ad if cross-sell is turned off.
  let ad: Record<string, unknown>;
  if (pick) {
    ad = { ad_id: pick.id, title: pick.title || pick.product_name || pick.advertiser_name || "Sponsored", image_url: pick.image_url || "", url: pick.landing_url || pick.product_url || "", founding: !!foundingOwnerId, founding_owner_id: foundingOwnerId, ppc_advertiser: ppcAdvertiser, earned_advertiser: earnedAdvertiser, makegood: !!makegoodOwnerId, makegood_owner_id: makegoodOwnerId,
      // Advertiser audio/video creative (falls back to the poster/thumbnail image when video/audio is
      // disabled or absent). The renderer plays this; the mandatory countdown is unchanged.
      ...resolveAdMedia(pick) };
  } else if (houseCrossSellEnabled()) {
    ad = pickHouseCrossSell(opts?.user);
  } else {
    ad = { ad_id: "house", title: opts?.houseTitle ?? "Sponsored", image_url: "", url: opts?.houseUrl ?? "/Pricing" };
  }

  return { ad, foundingOwnerId, ppcAdvertiser, earnedAdvertiser, makegoodOwnerId };
}
