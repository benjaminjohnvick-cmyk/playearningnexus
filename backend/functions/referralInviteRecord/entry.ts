import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { contactInviteEnabled, recordInviteBatch } from "../../sdk/referral-invite.ts";

// referralInviteRecord (authenticated) — the DEVICE reports that the user sent `count` referral invites from
// their OWN phone (native SMS). This does NOT send anything and MUST NOT include any contact data. It records
// the user's consent + a data-minimized count for the anti-spam daily cap and attribution.
//   { count, channel?, template_customized?, consent: { accepted: true } } → { ok, recorded, sent_today, remaining, capped }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!contactInviteEnabled()) return Response.json({ error: "Contact invites aren't enabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Consent is mandatory: the user affirms they have a relationship with the recipients and are sending from
    // their own device. Without it we do not record (and the client must not send).
    if (!body.consent || body.consent.accepted !== true) {
      return Response.json({ error: "Consent required: confirm you know these contacts and are sending from your own phone.", requires_consent: true }, { status: 400 });
    }
    const count = Math.max(0, Math.floor(Number(body.count) || 0));
    if (count <= 0) return Response.json({ error: "count must be a positive number of invites sent." }, { status: 400 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const consent = await recordConsent({
      user_id: user.id, kind: "referral_contact_invite", version: "1", accepted: true,
      shown: { affirmation: "I know these contacts and am sending referral invites from my own phone.", channel: body.channel || "sms" },
      ip, meta: { count },
    }).catch(() => null);

    const res = await recordInviteBatch(db, user.id, count, {
      channel: String(body.channel || "sms"),
      templateCustomized: body.template_customized === true,
      consentRef: consent ? String((consent as Record<string, unknown>).id || "") : null,
    });

    return Response.json({
      ok: true,
      ...res,
      note: res.capped
        ? `Recorded ${res.recorded}. You've reached today's invite limit — the rest weren't recorded. Try again tomorrow.`
        : `Recorded ${res.recorded} invite(s). ${res.remaining} left today.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
