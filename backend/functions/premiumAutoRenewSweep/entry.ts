import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  premiumAutoRenewEnabled, premiumAutoRenewAdvanceDays, premiumAutoRenewFinalHours,
  premiumRenewalTiming, premiumAdvanceNoticeCopy, premiumFinalNoticeCopy, renewalsDone,
} from "../../sdk/premium-autorenew.ts";

// premiumAutoRenewSweep — scheduled/admin. Drives the consumer PREMIUM default auto-renewal posture, entirely
// gated behind PREMIUM_AUTORENEW_ENABLED (OFF + counsel-gated). For each active membership approaching its
// expiry it sends the ADVANCE reminder (~30d) and FINAL warning (~24h) by email + account inbox, and at expiry
// records a RENEWAL INTENT (never charges — charging + term extension run on the gated payment path). Under
// the strict consent gate, a membership with no express auto-renew consent is NEVER auto-renewed (notice only).
// Consumer subscriptions are the highest auto-renewal-law risk — this stays dry until counsel enables it.
const FROM_NAME = "Get Goods Gratis (Free)";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    if (!premiumAutoRenewEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Premium auto-renewal is OFF (counsel-gated). No action taken." });
    }

    const body = await req.json().catch(() => ({}));
    const maxProcess = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const nowISO = new Date().toISOString();
    const nowMs = Date.parse(nowISO);

    const rows = await db.filter("PremiumPPCMembership", { status: "active" }, "-created_date", maxProcess).catch(() => []) as Record<string, unknown>[];

    let advanceSent = 0, finalSent = 0, renewed = 0, considered = 0;

    for (const rec of rows) {
      const t = premiumRenewalTiming(rec, nowMs);
      if (!t.active) continue;
      considered++;
      if (!t.enrolled) continue; // opted out, or (strict) no express consent on file → notice/skip, never auto-charge

      const uid = String(rec.user_id ?? "");
      const u = uid ? (await base44.asServiceRole.entities.User.filter({ id: uid }).then((r: Record<string, unknown>[]) => r?.[0]).catch(() => null)) : null;
      const name = String((u as Record<string, unknown>)?.full_name ?? "");
      const email = String((u as Record<string, unknown>)?.email ?? "");
      const renewOnISO = Number.isNaN(t.renew_at_ms) ? nowISO : new Date(t.renew_at_ms).toISOString();

      if (t.due_advance) {
        const copy = premiumAdvanceNoticeCopy({ name, renewOnISO, advanceDays: premiumAutoRenewAdvanceDays() });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "premium_autorenew_advance", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("PremiumPPCMembership", String(rec.id), { autorenew_advance_for: t.expires_key, autorenew_advance_sent_at: nowISO }).catch(() => null);
        advanceSent++;
      }

      if (t.due_final) {
        const copy = premiumFinalNoticeCopy({ name, renewOnISO, finalHours: premiumAutoRenewFinalHours() });
        if (email) await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: copy.subject, body: copy.body }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({ user_id: uid, type: "premium_autorenew_final", title: copy.title, message: copy.message, is_read: false }).catch(() => null);
        await db.update("PremiumPPCMembership", String(rec.id), { autorenew_final_for: t.expires_key, autorenew_final_sent_at: nowISO }).catch(() => null);
        finalSent++;
      }

      if (t.due_renewal) {
        // Renewal INTENT only — no charge, no term extension here (both run on the gated payment path).
        await db.update("PremiumPPCMembership", String(rec.id), {
          autorenew_intent_for: t.expires_key,
          autorenew_renewals: renewalsDone(rec) + 1,
          autorenew_last_intent_at: nowISO,
          autorenew_charge_status: "pending_gated_payment_path",
        }).catch(() => null);
        if (uid) await base44.asServiceRole.entities.Notification.create({
          user_id: uid, type: "premium_autorenew_intent",
          title: "Premium set to renew", message: "Your Premium membership is set to renew per your saved preference. Billing is processed on your existing terms; you can cancel any time.",
          is_read: false,
        }).catch(() => null);
        renewed++;
      }
    }

    return Response.json({
      ok: true, enabled: true, considered,
      advance_notices_sent: advanceSent, final_notices_sent: finalSent, renewal_intents: renewed,
      note: "Consumer Premium — renewals are INTENT only; no money moved here. Strict consent gate applies.",
      ran_at: nowISO,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
