import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { flexPayConfig, assessFlexPayOffer, buildFlexPlan, flexPayDisclosures } from "../../sdk/flexpay.ts";
import { findProduct } from "../../sdk/ai-funnel.ts";

// flexPayAccept — opt-in origination of a flexible-payment (installment) plan. HARD-GATED: refuses unless
// the program is live (flag + licensed provider + counsel sign-off), ability-to-repay is confirmed, and the
// disclosures are accepted. Payment is by CREDIT CARD (4 scheduled charges/year) — never from earnings. The
// next-tier upsell is an OPTIONAL opt-in recorded only if the customer affirmatively selects it — it is NEVER
// required to get the terms. This scaffold records the plan; the licensed creditor of record originates/
// services/bills/collects the card charges. It NEVER moves money itself.
//   Body: { product_key, ability_to_repay_confirmed, disclosures_acknowledged, opt_in_next_tier? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await flexPayConfig(jurisdiction);

    if (!cfg.live) return Response.json({ error: "Flexible payment terms are not available yet.", code: "program_not_live" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const product = findProduct(body.product_key ? String(body.product_key) : null);
    if (!product) return Response.json({ error: "Unknown product." }, { status: 400 });

    const atr = body.ability_to_repay_confirmed === true;
    const consent = body.disclosures_acknowledged === true;
    if (!consent || !atr) {
      return Response.json({ error: "You must confirm you can make the scheduled payments and accept the disclosures.", disclosures: flexPayDisclosures(cfg, product.price_usd) }, { status: 400 });
    }
    // Re-check eligibility server-side (last-resort + ATR + live).
    const offer = assessFlexPayOffer(cfg, product.price_usd, { lastResort: true, abilityToRepay: atr });
    if (!offer.available) return Response.json({ error: offer.reason }, { status: 400 });

    // OPTIONAL opt-in — only honored if the setting allows it AND the customer affirmatively selected it.
    // Never a condition of the plan.
    const optNextTier = cfg.nextTierOptIn && body.opt_in_next_tier === true;

    const plan = buildFlexPlan(product.price_usd, cfg);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const row = await db.create("FlexPayPlan", {
      user_id: user.id, product_key: product.key, product_name: product.name,
      price_usd: plan.price_usd, installments: plan.installments, interval_months: plan.interval_months,
      per_payment_usd: plan.per_payment_usd, schedule: plan.schedule, apr_pct: plan.apr_pct, recourse: plan.recourse,
      payment_method: "credit_card",               // credit card only — never from earnings
      opt_in_next_tier: optNextTier,               // optional, opt-in only
      status: "active", provider: cfg.provider,
      disclosures: offer.disclosures, disclosures_accepted: true, ability_to_repay_confirmed: true,
      accepted_at: new Date().toISOString(), consent_ip: ip,
    }, user.id);

    return Response.json({
      success: true, plan: row,
      note: "Flexible-payment plan recorded. Payment is by credit card (scheduled charges). The licensed creditor of record (FLEXPAY_PROVIDER) originates, services, and bills the installments. The next-tier option is optional and only stored if you selected it.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
