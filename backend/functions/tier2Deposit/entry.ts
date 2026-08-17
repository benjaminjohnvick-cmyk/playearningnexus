import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { tier2DepositEnabled, tier2DepositMonths, depositQuote, depositDisclosures } from "../../sdk/tier2-deposit.ts";
import { tier2Status } from "../../sdk/tier2-scaling.ts";

// tier2Deposit (authenticated) — record a full-year (or term) UPFRONT deposit for a Tier 2 seat. This is a
// PREPAYMENT for advertising delivered over time (the advertiser pays the platform now — not credit). It is
// earned only as impressions deliver; undelivered impressions at term end are made good or refunded pro-rata.
// Requires explicit acceptance of the deposit disclosures. Does NOT move money — the processor charges the
// net amount; this records the prepaid obligation + delivery terms on the plan.
//   { accept_deposit: true, months? } → { ok, quote, disclosures } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    if (!tier2DepositEnabled()) return Response.json({ error: "Upfront deposits aren't available for Tier 2 right now." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const months = Math.max(1, Math.round(Number(body.months) || tier2DepositMonths()));

    // Founding members get the perpetual discount; others the first-year rate — reuse the live status.
    const faRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const isFounding = !!faRows[0] && !["refunded", "cancelled"].includes(String(faRows[0].status ?? "").toLowerCase());
    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0] || null;
    const status = tier2Status(rec, isFounding, new Date().toISOString(), 0);
    const quote = depositQuote(status.discount_pct, months);
    const disclosures = depositDisclosures(quote);

    if (body.accept_deposit !== true) {
      // Preview the quote + terms; nothing recorded until the advertiser explicitly accepts.
      return Response.json({ preview: true, quote, disclosures, note: "Send { accept_deposit: true } to record the deposit." });
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await recordConsent({
      user_id: uid, kind: "tier2_deposit_terms", version: "2026-01", accepted: true,
      shown: { quote, disclosures }, ip, meta: { plan_id: rec?.id ?? null, months },
    }).catch(() => null);

    // Stamp the prepaid deposit + delivery terms on the plan (create a shell plan if none yet).
    const now = new Date().toISOString();
    const patch = {
      deposit_usd: quote.net_usd, deposit_months: months, deposit_paid_impressions: quote.paid_impressions,
      deposit_paid_at: now, deposit_terms_version: "2026-01",
    };
    let plan = rec;
    if (rec) plan = await db.update("Tier2ScalingPlan", String(rec.id), patch).catch(() => rec);
    else plan = await db.create("Tier2ScalingPlan", { user_id: uid, status: "active", parts: status.parts, parts_completed: 0, started_at: now, current_year_started_at: now, delivery_mode: "capacity_paced", ...patch }, uid).catch(() => null);

    return Response.json({
      ok: true, quote, disclosures, plan,
      note: `Deposit recorded for ${months} month(s). Charge $${quote.net_usd.toLocaleString()} via the normal checkout — this function does not move money. ` +
        "The deposit is earned only as impressions deliver; undelivered impressions at term end are made good or refunded.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
