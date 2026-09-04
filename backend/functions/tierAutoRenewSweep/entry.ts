import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  autoRenewEnabled, autoRenewResultsGated, autoRenewResultsMult, autoRenewAdvanceDays, autoRenewFinalHours,
  renewalTiming, recTier, currentYearStartISO, advanceNoticeCopy, finalNoticeCopy,
} from "../../sdk/tier-autorenew.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { tier2TotalUsd } from "../../sdk/tier2-scaling.ts";

// tierAutoRenewSweep — scheduled/admin. Drives the Tier 2/3 DEFAULT auto-renewal posture (owner request),
// entirely gated behind TIER_AUTORENEW_ENABLED (OFF + counsel-gated). For each in-term Tier 2/3 seat that is
// enrolled (opt-out posture) and approaching its annual boundary it:
//   • sends the ADVANCE reminder (email + account inbox) once, ~30 days out;
//   • sends the FINAL warning (email + account inbox) once, ~24 hours out;
//   • at the boundary, if results warrant it, records a RENEWAL INTENT (year++). It NEVER charges here — the
//     actual charge runs through the normal gated payment path. A seat that opted out, or whose results don't
//     warrant the year, is NOT renewed (never held in a losing year).
// No-op while the flag is off. Bounded per run. Money is never moved.
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const FROM_NAME = "Get Goods Gratis (Free)";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Scheduled service calls have no user; interactive calls must be admin.
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    if (!autoRenewEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Tier 2/3 auto-renewal is OFF (counsel-gated). No action taken." });
    }

    const body = await req.json().catch(() => ({}));
    const maxProcess = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const nowISO = new Date().toISOString();
    const nowMs = Date.parse(nowISO);
    const resultsGated = autoRenewResultsGated();
    const mult = autoRenewResultsMult();

    // Seats live as FoundingAdvertiser rows carrying a tier (the same records the progression sweep uses).
    const rows = await db.filter("FoundingAdvertiser", { status: "active" }, "-created_date", maxProcess).catch(() => []) as Record<string, unknown>[];

    let advanceSent = 0, finalSent = 0, renewed = 0, stopped = 0, considered = 0;

    for (const rec of rows) {
      const t = renewalTiming(rec, nowMs);
      if (!t.applies) continue;                 // not a Tier 2/3 seat
      considered++;

      const tier = recTier(rec);
      const uid = String(rec.user_id ?? rec.created_by ?? "");
      const name = String(rec.business_name ?? rec.full_name ?? rec.contact_name ?? "");
      const email = String(rec.email ?? rec.contact_email ?? "");
      const yearNumber = t.target_index + 1;    // renewing INTO this year number
      const yearCost = Number(rec.year_cost_usd ?? rec.paid_usd ?? rec.tier_price_usd ?? 0) || tier2TotalUsd();
      const renewOnISO = Number.isNaN(t.renew_at_ms) ? nowISO : new Date(t.renew_at_ms).toISOString();

      // A hard opt-out (or opt-in posture with no opt-in) means the seat is not enrolled — skip notices/renewal.
      if (!t.enrolled) continue;

      // ── Advance reminder (email + account inbox), once per cycle ──
      if (t.due_advance) {
        const copy = advanceNoticeCopy({ name, tier, yearNumber, renewOnISO, costUsd: yearCost, advanceDays: autoRenewAdvanceDays() });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "tier_autorenew_advance", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("FoundingAdvertiser", String(rec.id), { autorenew_advance_for: t.target_index, autorenew_advance_sent_at: nowISO }).catch(() => null);
        advanceSent++;
      }

      // ── Final warning (email + account inbox), once per cycle ──
      if (t.due_final) {
        const copy = finalNoticeCopy({ name, tier, yearNumber, renewOnISO, costUsd: yearCost, finalHours: autoRenewFinalHours() });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "tier_autorenew_final", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("FoundingAdvertiser", String(rec.id), { autorenew_final_for: t.target_index, autorenew_final_sent_at: nowISO }).catch(() => null);
        finalSent++;
      }

      // ── The renewal moment ──
      if (t.due_renewal) {
        // Results gate: prior year's real attributed results must warrant the renewal.
        let warrants = true;
        if (resultsGated && mult > 0) {
          const yearStartISO = currentYearStartISO(rec);
          const results = uid ? await attributedSalesUsd(db, uid, yearStartISO).catch(() => 0) : 0;
          warrants = results >= yearCost * mult;
        }
        if (warrants) {
          // Record renewal INTENT only — no charge here (charging stays on the gated payment path).
          await db.update("FoundingAdvertiser", String(rec.id), {
            autorenew_years_renewed: t.target_index,
            autorenew_last_renewed_at: nowISO,
            autorenew_renewed_into_year: yearNumber,
            autorenew_charge_status: "pending_gated_payment_path",
          }).catch(() => null);
          if (uid) await base44.asServiceRole.entities.Notification.create({
            user_id: uid, type: "tier_autorenew_renewed",
            title: `✅ Tier ${tier} renewed — year ${yearNumber}`,
            message: `Your Tier ${tier} advertising has auto-renewed into year ${yearNumber} (results warranted it). Billing is processed on your existing terms.`,
            is_read: false,
          }).catch(() => null);
          renewed++;
        } else {
          // Not warranted → do NOT renew; end the term. Never hold a losing advertiser in.
          await db.update("FoundingAdvertiser", String(rec.id), {
            autorenew_stopped: true, autorenew_stopped_reason: "results_did_not_warrant", autorenew_stopped_at: nowISO,
          }).catch(() => null);
          if (uid) await base44.asServiceRole.entities.Notification.create({
            user_id: uid, type: "tier_autorenew_not_renewed",
            title: `Tier ${tier} not auto-renewed`,
            message: `Your Tier ${tier} term wasn't auto-renewed because last year's results didn't warrant it — you're free to continue, adjust, or stop. No charge.`,
            is_read: false,
          }).catch(() => null);
          stopped++;
        }
      }
    }

    return Response.json({
      ok: true, enabled: true, considered,
      advance_notices_sent: advanceSent, final_notices_sent: finalSent,
      renewed_intents: renewed, stopped_results: stopped,
      note: "Renewals are recorded as INTENT only; no money is moved here.",
      ran_at: nowISO,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
