import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber, getString } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { ensureWelcomeCredit } from "../../sdk/welcome-credit.ts";

// physicalStoreConfig (authenticated) — everything the Physical Items store needs to render: which
// payment options are available, the card markup, the affordability threshold, the user's remaining
// promotional (welcome) credit, and the local-pickup note.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [card, affirm, layaway, pickup, store] = await Promise.all([
      isEnabled("card_charging").catch(() => false),
      isEnabled("affirm_bnpl").catch(() => false),
      isEnabled("layaway").catch(() => true),
      isEnabled("local_pickup").catch(() => true),
      isEnabled("physical_store").catch(() => true),
    ]);
    const [markup, affordLimit, pickupNote] = await Promise.all([
      getNumber("STORE_MARKUP", 0.10),
      getNumber("PHYSICAL_AFFORDABILITY_LIMIT_USD", 1460),
      getString("PICKUP_RADIUS_NOTE", ""),
    ]);
    const welcome = await ensureWelcomeCredit(user.id).catch(() => ({ remaining_usd: 0, expires_at: null, expired: true }));

    return Response.json({
      ok: true,
      enabled: store,
      options: {
        card,            // default primary option (adds markup)
        points: true,    // survey-earned points (closed-loop) — always available
        affirm,          // BNPL for real goods (licensed third party)
        layaway,         // reserve & pay down with points BEFORE delivery (no credit extended)
      },
      modes: { ship: true, pickup },
      markup_pct: Math.round(markup * 1000) / 10,
      affordability_limit_usd: affordLimit,
      pickup_note: pickupNote,
      welcome_credit_usd: Math.round((welcome.remaining_usd || 0) * 100) / 100,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
