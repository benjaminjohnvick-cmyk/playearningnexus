import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getBusinessAccount, ensureBusinessAccount } from "../../sdk/business-accounts.ts";
import { recordRevenue, audiencePanelPriceUsd } from "../../sdk/revenue.ts";
import { db } from "../../sdk/db.ts";

// createAudiencePanel (B23) — a business pays to run a survey/campaign against a TARGETED audience segment
// (e.g. a demographic, an interest, a country). Records the panel revenue and creates the panel spec the
// survey engine targets. Businesses pay; customers don't. (Data products must stay aggregate + consented.)
//   Body: { name, segment: { country?, interests?, min_age?, ... }, questions? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const price = audiencePanelPriceUsd();
    if (price <= 0) return Response.json({ error: "Audience panels aren't priced yet (set AUDIENCE_PANEL_PRICE_USD)." }, { status: 400 });

    const acct = await getBusinessAccount(user.id) || await ensureBusinessAccount(user.id, String(body.name || user.full_name || "Business"));

    const panel = await db.create("SponsoredPlacement", {
      owner_user_id: user.id, business_id: acct.id, slot: "audience_panel",
      panel_name: String(body.name || "Audience panel").slice(0, 120),
      segment: body.segment ?? {}, price_usd: price,
      status: "active", starts_at: new Date().toISOString(),
    }, user.id).catch(() => null);

    await recordRevenue({ type: "audience_panel", amount_usd: price, business_id: acct.id, user_id: user.id, ref: (panel as Record<string, unknown>)?.id as string ?? null, meta: { segment: body.segment ?? {} } });

    return Response.json({ success: true, panel_id: (panel as Record<string, unknown>)?.id ?? null, price_usd: price, note: "Panel booked. Insights delivered to the business must be aggregate + consented." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
