import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { maxPointsPerTransaction } from "../../sdk/redemption.ts";

// pointsApplyPreview (authenticated) — powers the "Apply my points" button at checkout: how many points the
// user COULD apply to this item and what it saves, WITHOUT committing anything. Read-only.
//   Body: { listing_id }  or  { price_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let faceUsd = Number(body.price_usd) || 0;
    if (!faceUsd && body.listing_id) {
      const l = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: body.listing_id }).then((r: any) => r[0]);
      faceUsd = Number(l?.price_usd) || 0;
    }
    if (faceUsd <= 0) return Response.json({ error: "No priced item to preview" }, { status: 400 });

    const pointUsd = pointValueUsd();
    const balance = Number(user.points) || 0;
    const premium = await isPremiumUser(user.id);
    const cap = maxPointsPerTransaction({ isPremium: premium, userPoints: balance });
    const faceInPoints = Math.floor(faceUsd / pointUsd);
    const pointsApplicable = Math.max(0, Math.min(cap.points, faceInPoints));
    const savingsUsd = Math.round(pointsApplicable * pointUsd * 100) / 100;

    return Response.json({
      balance,
      is_premium: premium,
      cap_pct: cap.capPct,
      face_usd: Math.round(faceUsd * 100) / 100,
      points_applicable: pointsApplicable,
      savings_usd: savingsUsd,
      card_after_points_usd: Math.round((faceUsd - savingsUsd) * 100) / 100,
      message: pointsApplicable > 0
        ? `Apply ${pointsApplicable.toLocaleString()} points to save $${savingsUsd.toFixed(2)} — card pays $${(faceUsd - savingsUsd).toFixed(2)}.`
        : "No points available to apply on this item right now.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
