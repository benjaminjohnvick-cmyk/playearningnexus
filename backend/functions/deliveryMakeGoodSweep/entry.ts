import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  deliveryGuaranteeEnabled,
  guaranteedUnits,
  guaranteeMaxExtensionMonths,
  guaranteeTermMonths,
  makeGoodStatus,
  fractionElapsed,
  termEnded,
  type GuaranteeTier,
} from "../../sdk/delivery-guarantee.ts";

// deliveryMakeGoodSweep (scheduled service-role) — the all-tiers DELIVERY make-good true-up. For every active
// advertising seat whose guarantee term has ended, it compares delivered impressions to the guaranteed volume
// and, on any shortfall, GRANTS a free make-good: it flags the seat to keep delivering at NO charge until the
// guaranteed volume is served (bounded — never more than what was sold), records an AdvertiserMakeGood, and
// emails the advertiser. Seats still inside their term are checked for under-pacing (informational only).
// It also closes out make-goods that have since been fulfilled or have hit their max extension window.
//
// This guarantees DELIVERY (what we control + measure), never revenue/ROI. Idempotent; moves no money.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!deliveryGuaranteeEnabled()) return Response.json({ skipped: true, reason: "delivery guarantee disabled" });

    const now = Date.now();
    const svc = base44.asServiceRole;

    const seats = (await svc.entities.FoundingAdvertiser.filter({ status: "active" }).catch(() => [])) as Record<string, unknown>[];
    let checked = 0, granted = 0, extended = 0, fulfilled = 0, emailed = 0, behind = 0;

    for (const seat of (seats || [])) {
      checked++;
      const uid = String(seat.user_id ?? "");
      if (!uid) continue;

      // Tier: a live Tier 2 plan makes this a tier2 seat; otherwise tier1/founding.
      const t2 = (await svc.entities.Tier2ScalingPlan.filter({ user_id: uid, status: "active" }).catch(() => [])) as Record<string, unknown>[];
      const tier: GuaranteeTier = (t2 && t2[0]) ? "tier2" : "tier1";
      // A Tier 3 Unlimited plan carries a custom guaranteed volume; back exactly that (scaled to the guarantee term).
      const planVol = Number(t2?.[0]?.guaranteed_impressions_per_year) || 0;
      const guaranteed = planVol > 0 ? Math.round(planVol * (guaranteeTermMonths() / 12)) : guaranteedUnits(tier);
      const startISO = String(seat.purchased_at ?? seat.credit_start ?? seat.created_date ?? "");

      // Existing make-good record for this seat (idempotency + baseline).
      const existing = (await svc.entities.AdvertiserMakeGood.filter({ seat_id: String(seat.id) }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
      const mg = existing && existing[0] ? existing[0] : null;

      const deliveredTotal = Number(seat.impressions_served) || 0;
      const baseline = Number(mg?.delivered_at_grant) || 0;
      const active = !!mg?.make_good_active;
      // Delivery counted for THIS period = served since the last grant baseline (0 on the first period).
      const delivered = Math.max(0, deliveredTotal - baseline);

      const st = makeGoodStatus({
        tier, guaranteedUnits: guaranteed, deliveredUnits: delivered,
        fractionElapsed: fractionElapsed(startISO, now), termEnded: termEnded(startISO, now),
      });

      // ── Case A: an active make-good — close it out if met or expired ────────────────────────────────
      if (active && mg) {
        const targetMet = deliveredTotal >= (Number(mg.target_impressions) || (baseline + guaranteed));
        const expired = mg.expires_at ? now >= Date.parse(String(mg.expires_at)) : false;
        if (targetMet || expired) {
          await svc.entities.AdvertiserMakeGood.update(String(mg.id), {
            make_good_active: false,
            status: targetMet ? "fulfilled" : "expired",
            closed_at: new Date(now).toISOString(),
            delivered_final: deliveredTotal,
          }).catch(() => null);
          await svc.entities.FoundingAdvertiser.update(String(seat.id), { makegood_active: false }).catch(() => null);
          fulfilled++;
        }
        continue; // an active make-good is already handled this period
      }

      // ── Case B: term still running — informational pacing only ──────────────────────────────────────
      if (!st.term_ended) { if (st.under_pacing) behind++; continue; }

      // ── Case C: term ended, shortfall → GRANT a free make-good (bounded) ────────────────────────────
      if (st.make_good_units > 0 && !st.fulfilled) {
        const expiresAt = new Date(now + guaranteeMaxExtensionMonths() * 30 * 86400000).toISOString();
        const record = {
          advertiser_id: uid,
          seat_id: String(seat.id),
          tier,
          guaranteed_units: guaranteed,
          delivered_at_grant: deliveredTotal,          // baseline: what was served when the make-good began
          shortfall_units: st.make_good_units,
          target_impressions: deliveredTotal + st.make_good_units, // deliver up to here, then stop (bounded)
          make_good_active: true,
          status: "extending",
          granted_at: new Date(now).toISOString(),
          expires_at: expiresAt,
          basis: st.note,
        };
        if (mg) {
          await svc.entities.AdvertiserMakeGood.update(String(mg.id), record).catch(() => null);
        } else {
          await svc.entities.AdvertiserMakeGood.create(record).catch(() => null);
        }
        // Flag the seat so the ad-serving path keeps delivering free until the target is met.
        await svc.entities.FoundingAdvertiser.update(String(seat.id), {
          makegood_active: true,
          makegood_target_impressions: record.target_impressions,
        }).catch(() => null);
        granted++;
        if (mg) extended++;

        // Notify the advertiser (best-effort).
        try {
          const u = (await svc.entities.User.filter({ id: uid }).catch(() => []))[0] as Record<string, unknown> | undefined;
          if (u?.email) {
            await svc.integrations.Core.SendEmail({
              to: String(u.email), from_name: "Advertiser Delivery",
              subject: "Delivery make-good applied to your campaign",
              body: `Your advertising guarantee for this term was ${guaranteed.toLocaleString()} impressions, and we delivered ` +
                `${delivered.toLocaleString()}. We're making up the ${st.make_good_units.toLocaleString()}-impression shortfall with ` +
                `FREE additional inventory — your ads keep running at no extra charge until the full guaranteed volume is served. ` +
                `\n\nThis make-good covers the ADVERTISING we deliver; it is not a revenue or ROI guarantee.`,
            }).catch(() => null);
            emailed++;
          }
        } catch { /* email optional */ }
      }
    }

    return Response.json({ ok: true, seats_checked: checked, make_goods_granted: granted, extended, closed_out: fulfilled, under_pacing: behind, emailed });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
