// referral-invite.ts — the COMPLIANT contact-invite referral flow.
//
// CRITICAL DESIGN: the user's OWN phone sends the messages (native SMS / share sheet). The server NEVER
// sends messages and NEVER receives or stores the contact list, phone numbers, names, or message bodies.
// This is what keeps the flow clear of TCPA / CAN-SPAM: it is a person texting people they know from their
// own number — not a platform blasting un-consented numbers. The server only provides the referral link and
// an optional template, records the user's consent, and keeps a data-minimized daily COUNT for anti-spam.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export const contactInviteEnabled = () => snapBool("REFERRAL_CONTACT_INVITE_ENABLED", true);
export const inviteDailyCap = () => Math.max(0, snapNumber("REFERRAL_INVITE_DAILY_CAP", 50));
export const inviteBaseUrl = () => (snapString("REFERRAL_INVITE_BASE_URL", "https://gamergain.app") || "https://gamergain.app").replace(/\/+$/, "");
export const inviteTemplate = () => snapString("REFERRAL_INVITE_TEMPLATE",
  "Hi {{name}}! I've been using GamerGain to earn rewards in my spare time — thought you'd like it. Join with my link: {{link}}");

/** A user's personal referral link (matches the app's existing ?ref=<user id> convention). */
export function referralLinkFor(userId: string): string {
  return `${inviteBaseUrl()}/?ref=${encodeURIComponent(userId)}`;
}

type Dbi = {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
  create: (name: string, doc: Record<string, unknown>, createdBy?: string) => Promise<Record<string, unknown>>;
};

/** How many invites a user has already sent today (from the data-minimized batch log). */
export async function invitesSentToday(dbi: Dbi, userId: string, dayISO: string): Promise<number> {
  const rows = await dbi.filter("ReferralInviteBatch", { user_id: userId, day: dayISO }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
  return (rows || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

/** Remaining invites a user may send today under the anti-spam cap. */
export async function invitesRemaining(dbi: Dbi, userId: string, dayISO: string): Promise<number> {
  const cap = inviteDailyCap();
  if (cap <= 0) return 0;
  return Math.max(0, cap - (await invitesSentToday(dbi, userId, dayISO)));
}

/** Record that the user sent `count` invites FROM THEIR DEVICE. Enforces the daily cap. Stores NO contacts —
 *  only the count + channel + consent ref. Returns what was accepted (may be clamped by the remaining cap). */
export async function recordInviteBatch(
  dbi: Dbi, userId: string, count: number, opts?: { channel?: string; templateCustomized?: boolean; consentRef?: string; dayISO?: string },
): Promise<{ recorded: number; sent_today: number; remaining: number; capped: boolean }> {
  const day = opts?.dayISO || new Date().toISOString().slice(0, 10);
  const already = await invitesSentToday(dbi, userId, day);
  const cap = inviteDailyCap();
  const room = cap <= 0 ? 0 : Math.max(0, cap - already);
  const want = Math.max(0, Math.floor(Number(count) || 0));
  const accepted = Math.min(want, room);
  if (accepted > 0) {
    await dbi.create("ReferralInviteBatch", {
      user_id: userId, day, count: accepted,
      channel: String(opts?.channel || "sms"),
      template_customized: opts?.templateCustomized === true,
      consent_ref: opts?.consentRef || null,
      // NOTE: intentionally NO contact/phone/name/message fields — those never leave the device.
    }, userId).catch(() => null);
  }
  return { recorded: accepted, sent_today: already + accepted, remaining: Math.max(0, room - accepted), capped: want > accepted };
}
