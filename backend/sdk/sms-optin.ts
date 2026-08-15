// sms-optin.ts — verifiable SMS marketing consent capture (double opt-in). The front door to the compliant
// SMS path.
//
// SMS marketing is lawful only with the recipient's verifiable prior express consent (TCPA). The compliant
// version IS user opt-in — so this captures it properly: the user submits their number and explicitly agrees
// to the consent language, we record a pending consent, and a confirmation step (double opt-in) flips it to
// confirmed with a timestamp + the exact disclosure shown. It stores a durable consent record and supports
// STOP/revoke. It does NOT send any SMS — actually sending still requires the sms_marketing flag ON plus a
// real SMS provider; this only makes the consent real so that path can be turned on lawfully later.
// See SMS-OPTIN.md.
import { isEnabled } from "./feature-flags.ts";
import { getString } from "./settings.ts";
import { db } from "./db.ts";

export interface SmsOptInConfig { enabled: boolean; disclosure: string; }

export async function smsOptInConfig(jurisdiction?: string | null): Promise<SmsOptInConfig> {
  return {
    enabled: await isEnabled("sms_optin_capture", jurisdiction ?? null),
    disclosure: await getString("SMS_OPTIN_DISCLOSURE", "By opting in you agree to receive recurring marketing text messages at the number provided. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out, HELP for help."),
  };
}

// E.164-ish normalization: keep a leading + and digits. Not a validation service — just tidy storage.
export function normalizePhone(raw: string): string {
  const s = String(raw || "").trim();
  const plus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  return digits ? (plus ? "+" : "") + digits : "";
}

export async function currentConsent(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.filter("ConsentRecord", { user_id: userId, kind: "sms_marketing" }, "-created_date", 1);
    return (rows && rows[0]) || null;
  } catch { return null; }
}

export function consentView(row: Record<string, unknown> | null): Record<string, unknown> {
  if (!row) return { status: "none", phone: null, confirmed: false };
  return {
    status: String(row.status || "none"),      // none | pending | confirmed | revoked
    phone: row.phone ?? null,
    confirmed: String(row.status) === "confirmed",
    consented_at: row.consented_at ?? null,
    confirmed_at: row.confirmed_at ?? null,
  };
}
