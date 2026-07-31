import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { giftCardAvailability, pointsForGiftCardUsd } from "../../sdk/giftcards.ts";

// giftCardOptions (authenticated) — what gift cards are available to redeem points for (retailer, face
// values, and the points each costs), plus the user's current balance.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const avail = await giftCardAvailability();
    const options = Object.entries(avail).map(([retailer, info]) => ({
      retailer, count: info.count,
      denominations: info.face_values.sort((a, b) => a - b).map((fv) => ({ face_value_usd: fv, points: pointsForGiftCardUsd(fv) })),
    }));
    return Response.json({ balance: Number(user.points) || 0, options });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
