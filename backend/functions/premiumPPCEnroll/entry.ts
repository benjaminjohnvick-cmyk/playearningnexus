import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  advanceLimit, liveChargesEnabled, PPC_GRID_ANNUAL_PRICE,
} from "../../sdk/premium-ppc.ts";

// premiumPPCEnroll — a user joins the (free) Premium PPC program.
// Requires: explicit T&C consent + a card on file (authorization for later variable charges).
// Enforces the 1:1 advertiser⇄user cap: there must be an unmatched paying advertiser slot.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const consent = body.consent ?? {};
    if (consent.accepted !== true || !consent.terms_version) {
      return Response.json({ error: "You must accept the Premium PPC terms (consent.accepted + terms_version required)." }, { status: 400 });
    }
    const paymentMethodId = body.payment_method_id ?? null;
    if (!paymentMethodId) {
      return Response.json({ error: "A card on file is required (payment_method_id). It authorizes the missed-day charges described in the terms." }, { status: 400 });
    }

    // Already enrolled?
    const existing = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const active = (existing || []).find((m: Record<string, unknown>) => m.status === "active" || m.status === "repaid");
    if (active) return Response.json({ error: "You are already enrolled in Premium PPC.", membership: active }, { status: 409 });

    // --- 1:1 advertiser slot check ---
    // Advertisers = users active on the paid PPC grid. Each backs at most one premium user.
    const advertisers = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true });
    const memberships = await base44.asServiceRole.entities.PremiumPPCMembership.list("-created_date", 5000);
    const taken = new Set((memberships || [])
      .filter((m: Record<string, unknown>) => m.status === "active" || m.status === "repaid")
      .map((m: Record<string, unknown>) => m.advertiser_user_id));
    const openAdvertiser = (advertisers || []).find((a: Record<string, unknown>) => a.id !== user.id && !taken.has(a.id));
    if (!openAdvertiser) {
      return Response.json({
        error: "No advertiser slots available. Premium PPC is capped 1:1 to paying advertisers.",
        advertisers: (advertisers || []).length,
        matched: taken.size,
      }, { status: 409 });
    }

    // --- Card on file ---
    // Live mode: create/attach a Stripe customer + payment method so we can charge off-session
    // later. Test mode: store the ids without touching Stripe (nothing will be charged anyway).
    let stripeCustomerId: string | null = user.stripe_customer_id ?? null;
    if (liveChargesEnabled()) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return Response.json({ error: "STRIPE_SECRET_KEY not set (required when PREMIUM_PPC_LIVE_CHARGES=1)." }, { status: 500 });
      if (!stripeCustomerId) {
        const cRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ email: user.email ?? "", name: user.full_name ?? "", "metadata[user_id]": user.id }),
        });
        const c = await cRes.json();
        if (!cRes.ok || c.error) return Response.json({ error: c?.error?.message ?? "Stripe customer create failed" }, { status: 400 });
        stripeCustomerId = c.id;
        await base44.asServiceRole.entities.User.update(user.id, { stripe_customer_id: stripeCustomerId });
      }
      // Attach the payment method + make it default for off-session use.
      const aRes = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethodId}/attach`, {
        method: "POST",
        headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ customer: stripeCustomerId! }),
      });
      const a = await aRes.json();
      if (!aRes.ok || a.error) return Response.json({ error: a?.error?.message ?? "Stripe attach failed" }, { status: 400 });
      await fetch(`https://api.stripe.com/v1/customers/${stripeCustomerId}`, {
        method: "POST",
        headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "invoice_settings[default_payment_method]": paymentMethodId }),
      });
    } else if (!stripeCustomerId) {
      stripeCustomerId = `test_cus_${user.id}`;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const membership = await base44.asServiceRole.entities.PremiumPPCMembership.create({
      user_id: user.id,
      advertiser_user_id: openAdvertiser.id,
      stripe_customer_id: stripeCustomerId,
      payment_method_id: paymentMethodId,
      consent: { accepted: true, terms_version: consent.terms_version, at: new Date().toISOString(), ip },
      grid_price: PPC_GRID_ANNUAL_PRICE,
      advance_limit: advanceLimit(),
      advance_disbursed: 0,
      repaid_to_advertiser: 0,
      business_refund_credit: 0,
      social_credit_to_advertiser: 0,
      status: "active",
      live_mode: liveChargesEnabled(),
      enrolled_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      membership,
      matched_advertiser_id: openAdvertiser.id,
      advance_available: advanceLimit(),
      live_mode: liveChargesEnabled(),
      note: liveChargesEnabled()
        ? "Live mode: your card may be charged $8 for each day you do not earn $8, per the terms."
        : "TEST MODE: no real charges will occur until the platform enables live charges.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
