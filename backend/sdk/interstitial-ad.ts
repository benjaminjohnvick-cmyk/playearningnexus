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

export type PickedInterstitial = {
  ad: Record<string, unknown>;
  foundingOwnerId: string | null;
  ppcAdvertiser: boolean;
  earnedAdvertiser: boolean;
  makegoodOwnerId: string | null;
};

// deno-lint-ignore no-explicit-any
export async function pickInterstitialAd(base44: any, db: any, opts?: { ppcPriority?: boolean; houseTitle?: string; houseUrl?: string; adfreeOnly?: boolean }): Promise<PickedInterstitial> {
  const ppcPriority = opts?.ppcPriority ?? true;

  let slots = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" })
    // deno-lint-ignore no-explicit-any
    .then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];

  // adfreeOnly: the premium "extra minute" placement includes every active creative BY DEFAULT (part of the
  // offer); an advertiser is in unless they explicitly opted out (adfree_minute_optout === true). If every
  // eligible creative has opted out, falls through to the house ad below.
  if (opts?.adfreeOnly) slots = (slots || []).filter((s) => s.adfree_minute_optout !== true);

  let pick = (slots || [])[0] || null;
  let foundingOwnerId: string | null = null;
  let ppcAdvertiser = false;

  // 1) Founding advertisers first.
  if (foundingInterstitialPriority() && (slots || []).length) {
    const owners = await activeFoundingAdOwners(db).catch(() => new Set<string>());
    const fpick = (slots || []).find((s) => owners.has(String(s.created_by)));
    if (fpick) { pick = fpick; foundingOwnerId = String(fpick.created_by); }
  }

  // 2) Paying PPC-grid advertisers. Bounded id-$in lookup over only the candidate slots' owners — never
  //    load the whole paying-advertiser population.
  if (!foundingOwnerId && ppcPriority && (slots || []).length) {
    const ownerIds = Array.from(new Set(
      (slots || []).flatMap((s) => [String(s.advertiser_user_id ?? ""), String(s.created_by ?? "")]).filter(Boolean),
    ));
    let paying = new Set<string>();
    if (ownerIds.length) {
      const payingRows = await base44.asServiceRole.entities.User
        .filter({ id: { $in: ownerIds }, ppc_grid_active: true })
        // deno-lint-ignore no-explicit-any
        .then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
      paying = new Set((payingRows || []).map((a) => String(a.id)));
    }
    const ppick = (slots || []).find((s) => paying.has(String(s.advertiser_user_id)) || paying.has(String(s.created_by)));
    if (ppick) { pick = ppick; ppcAdvertiser = true; }
  }

  // 3) Earned / free advertisers currently delivering.
  let earnedAdvertiser = false;
  if (!foundingOwnerId && !ppcAdvertiser && (slots || []).length) {
    const earnedOwners = await activeEarnedAdOwners(db, new Date().toISOString().slice(0, 10)).catch(() => new Set<string>());
    if (earnedOwners.size) {
      const epick = (slots || []).find((s) => earnedOwners.has(String(s.advertiser_user_id)) || earnedOwners.has(String(s.created_by)));
      if (epick) { pick = epick; earnedAdvertiser = true; }
    }
  }

  // 4) Residual make-good delivery.
  let makegoodOwnerId: string | null = null;
  if (!foundingOwnerId && !ppcAdvertiser && !earnedAdvertiser && (slots || []).length) {
    const mgOwners = await activeMakeGoodOwners(db).catch(() => new Set<string>());
    if (mgOwners.size) {
      const mpick = (slots || []).find((s) => mgOwners.has(String(s.advertiser_user_id)) || mgOwners.has(String(s.created_by)));
      if (mpick) { pick = mpick; makegoodOwnerId = String(mpick.advertiser_user_id ?? mpick.created_by); }
    }
  }

  // 5) House ad fallback.
  const ad = pick
    ? { ad_id: pick.id, title: pick.title || pick.product_name || pick.advertiser_name || "Sponsored", image_url: pick.image_url || "", url: pick.landing_url || pick.product_url || "", founding: !!foundingOwnerId, founding_owner_id: foundingOwnerId, ppc_advertiser: ppcAdvertiser, earned_advertiser: earnedAdvertiser, makegood: !!makegoodOwnerId, makegood_owner_id: makegoodOwnerId }
    : { ad_id: "house", title: opts?.houseTitle ?? "Sponsored", image_url: "", url: opts?.houseUrl ?? "/Pricing" };

  return { ad, foundingOwnerId, ppcAdvertiser, earnedAdvertiser, makegoodOwnerId };
}
