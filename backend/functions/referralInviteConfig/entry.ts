import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { contactInviteEnabled, inviteDailyCap, inviteTemplate, referralLinkFor, invitesSentToday } from "../../sdk/referral-invite.ts";

// referralInviteConfig (authenticated) — read-only config for the on-device contact-invite flow. Returns the
// user's referral link, the customizable template, and today's remaining allowance. The server NEVER sends
// messages and NEVER receives contacts — sending happens on the user's own device.
//   {} → { enabled, referral_link, template, daily_cap, sent_today, remaining, guardrails }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!contactInviteEnabled()) return Response.json({ enabled: false });

    const day = new Date().toISOString().slice(0, 10);
    const sent = await invitesSentToday(db, user.id, day);
    const cap = inviteDailyCap();

    return Response.json({
      enabled: true,
      referral_link: referralLinkFor(user.id),
      template: inviteTemplate(),                 // customizable client-side; {{name}} and {{link}} placeholders
      daily_cap: cap,
      sent_today: sent,
      remaining: Math.max(0, cap - sent),
      guardrails: {
        sends_from_user_device: true,             // native SMS/share — the server never sends
        server_stores_contacts: false,            // contacts never leave the device
        consent_required: true,                   // user must grant contact access + confirm they know the recipients
        review_before_send: true,                 // user reviews/customizes, then taps send themselves
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
