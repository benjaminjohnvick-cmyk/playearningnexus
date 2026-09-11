import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  autoRenewMode, autoRenewResultsGated, autoRenewResultsMult, autoRenewAdvanceDays, autoRenewFinalHours,
  renewalTiming, recTier, currentYearStartISO, advanceNoticeCopy, finalNoticeCopy, renewPromptCopy,
  scaleUpTarget, scaleUpNoticeLine,
} from "../../sdk/tier-autorenew.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { tier2TotalUsd } from "../../sdk/tier2-scaling.ts";
import { tier1ValueTargetUsd } from "../../sdk/tier1-value-stack.ts";
import { tier3UnlimitedMinUsd } from "../../sdk/tier3-unlimited.ts";

// Tier-aware year cost: prefer the seat's own recorded cost; else fall back to the tier's standard price.
function tierYearCost(rec: Record<string, unknown>, tier: number): number {
  const explicit = Number(rec.year_cost_usd ?? rec.paid_usd ?? rec.tier_price_usd ?? 0);
  if (explicit > 0) return explicit;
  if (tier === 1) return tier1ValueTargetUsd();
  if (tier === 3) return tier3UnlimitedMinUsd();
  return tier2TotalUsd();
}

// tierAutoRenewSweep — scheduled/admin. Drives the auto-renewal posture across ALL advertiser tiers (1, 2 & 3)
// in one of two modes (autoRenewMode):
//   • "charge"   — full default auto-renewal (opt-out, counsel-gated via TIER_AUTORENEW_ENABLED): advance +
//                  final notices, then at the boundary records a RENEWAL INTENT (year++) if results warrant.
//                  Still NEVER charges here — the charge runs through the normal gated payment path.
//   • "reminder" — the NON-counsel path (TIER_AUTORENEW_REMINDER_ENABLED, opt-in): advance + final reminders,
//                  then at the boundary a one-tap "renew" PROMPT. It NEVER auto-advances a term and NEVER
//                  charges — the advertiser renews affirmatively via advertiserRenewAgree. Not a negative option.
//   • "off"      — no-op.
// For each in-term seat in an auto-renew tier that's eligible (not opted out) and approaching its annual boundary
// it sends the mode-appropriate notices. Bounded per run. Money is never moved in either mode.
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const FROM_NAME = "Get Goods Gratis (Free)";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Scheduled service calls have no user; interactive calls must be admin.
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    const mode = autoRenewMode();
    if (mode === "off") {
      return Response.json({ ok: true, enabled: false, mode, note: "Auto-renew is OFF — both the counsel-gated auto-charge switch (TIER_AUTORENEW_ENABLED) and the reminder-only switch (TIER_AUTORENEW_REMINDER_ENABLED) are off. No action taken." });
    }
    const reminder = mode === "reminder";

    const body = await req.json().catch(() => ({}));
    const maxProcess = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const nowISO = new Date().toISOString();
    const nowMs = Date.parse(nowISO);
    const resultsGated = autoRenewResultsGated();
    const mult = autoRenewResultsMult();

    // Seats live as FoundingAdvertiser rows carrying a tier (the same records the progression sweep uses).
    const rows = await db.filter("FoundingAdvertiser", { status: "active" }, "-created_date", maxProcess).catch(() => []) as Record<string, unknown>[];

    let advanceSent = 0, finalSent = 0, renewed = 0, stopped = 0, considered = 0, scaledUp = 0, prompted = 0;

    for (const rec of rows) {
      // Eligibility: reminder mode reaches any seat that hasn't opted out (renewal only happens on their click);
      // charge mode uses the strict, consent-gated enrollment.
      const eligible = rec.auto_renew_optout !== true;
      const t = reminder ? renewalTiming(rec, nowMs, { enrolledOverride: eligible }) : renewalTiming(rec, nowMs);
      if (!t.applies) continue;                 // not an auto-renew tier (1/2/3 per TIER_AUTORENEW_TIERS)
      considered++;

      const tier = recTier(rec);
      const uid = String(rec.user_id ?? rec.created_by ?? "");
      const name = String(rec.business_name ?? rec.full_name ?? rec.contact_name ?? "");
      const email = String(rec.email ?? rec.contact_email ?? "");
      const yearNumber = t.target_index + 1;    // renewing INTO this year number
      const yearCost = tierYearCost(rec, tier);
      const renewOnISO = Number.isNaN(t.renew_at_ms) ? nowISO : new Date(t.renew_at_ms).toISOString();

      // A hard opt-out (or opt-in posture with no opt-in) means the seat is not enrolled — skip notices/renewal.
      if (!t.enrolled) continue;

      // ── Advance reminder (email + account inbox), once per cycle ──
      if (t.due_advance) {
        // Flywheel leverage: if prior-year results strongly beat cost, INVITE a scale-up (suggestion only).
        let scaleUpLine: string | undefined;
        if (uid) {
          const priorResults = await attributedSalesUsd(db, uid, currentYearStartISO(rec)).catch(() => 0);
          const up = scaleUpTarget(tier, priorResults, yearCost);
          if (up) scaleUpLine = scaleUpNoticeLine(tier, up);
        }
        const copy = advanceNoticeCopy({ name, tier, yearNumber, renewOnISO, costUsd: yearCost, advanceDays: autoRenewAdvanceDays(), scaleUpLine, reminder });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "tier_autorenew_advance", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("FoundingAdvertiser", String(rec.id), { autorenew_advance_for: t.target_index, autorenew_advance_sent_at: nowISO }).catch(() => null);
        advanceSent++;
      }

      // ── Final warning (email + account inbox), once per cycle ──
      if (t.due_final) {
        const copy = finalNoticeCopy({ name, tier, yearNumber, renewOnISO, costUsd: yearCost, finalHours: autoRenewFinalHours(), reminder });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "tier_autorenew_final", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("FoundingAdvertiser", String(rec.id), { autorenew_final_for: t.target_index, autorenew_final_sent_at: nowISO }).catch(() => null);
        finalSent++;
      }

      // ── The renewal moment ──
      if (t.due_renewal) {
        // Prior year's real attributed results — used for BOTH the results gate and the scale-up invite.
        const results = uid ? await attributedSalesUsd(db, uid, currentYearStartISO(rec)).catch(() => 0) : 0;

        // REMINDER MODE: send a one-tap "renew" prompt (once), never auto-advance, never charge. The advertiser
        // renews affirmatively via advertiserRenewAgree. Results only shape the optional scale-up invite here.
        if (reminder) {
          const promptFor = Math.floor(Number(rec.autorenew_prompt_for) || 0);
          if (promptFor < t.target_index) {
            const up = scaleUpTarget(tier, results, yearCost);
            const scaleUpLine = up ? scaleUpNoticeLine(tier, up) : undefined;
            const copy = renewPromptCopy({ name, tier, yearNumber, costUsd: yearCost, scaleUpLine });
            if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
            if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "tier_renew_prompt", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
            await db.update("FoundingAdvertiser", String(rec.id), { autorenew_prompt_for: t.target_index, autorenew_prompt_sent_at: nowISO }).catch(() => null);
            if (up) scaledUp++;
            prompted++;
          }
          continue; // reminder mode never advances the term itself
        }

        const warrants = !resultsGated || mult <= 0 || results >= yearCost * mult;
        if (warrants) {
          // Record renewal INTENT only — no charge here (charging stays on the gated payment path).
          await db.update("FoundingAdvertiser", String(rec.id), {
            autorenew_years_renewed: t.target_index,
            autorenew_last_renewed_at: nowISO,
            autorenew_renewed_into_year: yearNumber,
            autorenew_charge_status: "pending_gated_payment_path",
          }).catch(() => null);
          // Flywheel leverage: proven winners get an honest scale-up invite in the confirmation (opt-in only).
          const up = scaleUpTarget(tier, results, yearCost);
          const scaleMsg = up ? ` ${scaleUpNoticeLine(tier, up)}` : "";
          if (up) scaledUp++;
          if (uid) await base44.asServiceRole.entities.Notification.create({
            user_id: uid, type: "tier_autorenew_renewed",
            title: `✅ Tier ${tier} renewed — year ${yearNumber}`,
            message: `Your Tier ${tier} advertising has auto-renewed into year ${yearNumber} (results warranted it). Billing is processed on your existing terms.${scaleMsg}`,
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
      ok: true, enabled: true, mode, considered,
      advance_notices_sent: advanceSent, final_notices_sent: finalSent,
      renew_prompts_sent: prompted, renewed_intents: renewed, stopped_results: stopped, scaleup_invites: scaledUp,
      note: reminder
        ? "Reminder-only mode: renewal REMINDERS + one-tap prompts sent. Nothing auto-renewed and no money moved — advertisers renew affirmatively (advertiserRenewAgree). Not a negative option."
        : "Auto-charge mode: renewals recorded as INTENT only; no money moved here. Scale-up is an invite only — never an automatic tier change or charge.",
      ran_at: nowISO,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
