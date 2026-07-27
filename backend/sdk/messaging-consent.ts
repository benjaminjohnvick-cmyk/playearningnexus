import { snapString } from "./settings.ts";
// TCPA / CAN-SPAM consent + unsubscribe helpers (Master Plan #10).
//
//   • canSms(user)         — TCPA requires AFFIRMATIVE opt-in: the sms_marketing flag must be ON and
//                            the user must have explicitly opted in and not opted out.
//   • canEmailMarket(user) — CAN-SPAM: marketing email needs the email_marketing flag ON, the user
//                            not opted out, and a working unsubscribe path.
//   • emailUnsubscribeFooter(user) — the required unsubscribe + physical-address footer.
//   • SMS_OPT_OUT_SUFFIX   — the required "Reply STOP to opt out." line for SMS bodies.
import { isEnabled } from "./feature-flags.ts";

export const SMS_OPT_OUT_SUFFIX = " Reply STOP to opt out.";

export function emailUnsubscribeFooter(user: Record<string, unknown>): string {
  const base = (Deno.env.get("FRONTEND_URL") ?? "https://gamergain.app").replace(/\/$/, "");
  const email = encodeURIComponent(String(user.email ?? ""));
  const addr = snapString("BUSINESS_MAILING_ADDRESS", "[your business mailing address]");
  return `\n\n—\nYou're receiving this because you have a GamerGain account. ` +
    `Unsubscribe: ${base}/unsubscribe?email=${email}\nGamerGain · ${addr}`;
}

/** Marketing email allowed? email_marketing flag ON, user not opted out, has an address. */
export async function canEmailMarket(user: Record<string, unknown>): Promise<boolean> {
  if (!(await isEnabled("email_marketing"))) return false;
  if (user.email_opt_out === true) return false;
  const prefs = (user.notification_preferences ?? {}) as Record<string, unknown>;
  if (prefs.email_enabled === false) return false;
  return !!user.email;
}

/** SMS allowed? sms_marketing flag ON + explicit opt-in + not opted out + has a phone. */
export async function canSms(user: Record<string, unknown>): Promise<boolean> {
  if (!(await isEnabled("sms_marketing"))) return false;
  if (user.sms_opt_out === true) return false;
  const prefs = (user.notification_preferences ?? {}) as Record<string, unknown>;
  const explicitOptIn = user.sms_consent === true || prefs.sms_enabled === true;
  return explicitOptIn && !!user.phone_number;
}
