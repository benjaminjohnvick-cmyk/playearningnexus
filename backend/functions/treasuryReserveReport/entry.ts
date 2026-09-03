import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber, snapString } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";
import { solvency } from "../../sdk/treasury.ts";
import { paypalConfigured } from "../../sdk/paypal-api.ts";

// treasuryReserveReport (ADMIN) — the up-to-date solvency picture for the business account: cash available,
// the reserve that MUST stay to cover every obligation (outstanding Site Cash, pending payouts, tax set-aside,
// buffer), and how much is safe to withdraw. Also reports the platform-funded portion of unsettled orders
// (informational) and the PayPal auto-settlement readiness gates. Read-only; moves no money.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const s = await solvency();

    // Informational: platform-funded discount cost sitting on orders not yet settled (Site Cash the platform
    // covered on the seller's behalf). Reported so you can see it; not double-added to the reserve here.
    const orderFunded = await db.sum("Order", "points_usd_funded", { status: { $in: ["awaiting_shipment", "shipped", "processing", "fulfilling"] } }).catch(() => 0);

    // PayPal auto-settlement readiness — every gate that must be true before live money moves automatically.
    const gates = {
      paypal_credentials_configured: paypalConfigured(),
      autosettle_enabled: snapBool("PAYPAL_AUTOSETTLE_ENABLED", false),
      signed_off: snapString("PAYPAL_AUTOSETTLE_SIGNOFF", "") === "OWNER_APPROVED",
      solvent: s.solvent,
      max_per_run_usd: snapNumber("PAYPAL_AUTOSETTLE_MAX_PER_RUN_USD", 1000),
    };
    const autosettle_live = gates.paypal_credentials_configured && gates.autosettle_enabled && gates.signed_off && gates.solvent;

    return Response.json({
      ok: true,
      as_of: new Date().toISOString(),
      available_usd: s.available_usd,
      required_reserve_usd: s.required_reserve_usd,
      safe_to_withdraw_usd: s.safe_to_withdraw_usd,
      shortfall_usd: s.shortfall_usd,
      solvent: s.solvent,
      reserve_components: s.components,
      unsettled_order_funded_usd: Math.round((Number(orderFunded) || 0) * 100) / 100,
      paypal_autosettlement: { live: autosettle_live, gates },
      note: s.solvent
        ? `You can safely withdraw up to $${s.safe_to_withdraw_usd.toLocaleString()}. $${s.required_reserve_usd.toLocaleString()} must stay to cover obligations.`
        : `SHORTFALL: the account is $${s.shortfall_usd.toLocaleString()} short of covering its obligations — do not withdraw; top up the account.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
