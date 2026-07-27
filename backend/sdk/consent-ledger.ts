// Immutable consent & disclosure ledger (Master Plan 0.3).
//
// Append-only record of every consent and disclosure: terms accepted, auto-renewal shown, SMS/email
// opt-in, earnings disclosure shown, age attestation, social-posting permission. One query answers
// "did they agree, and to exactly what, and when?" — which is your single cheapest piece of evidence
// in any dispute, audit, or regulator inquiry.
//
// Records are NEVER updated or deleted; a newer record supersedes an older one.
import { db } from "./db.ts";

export interface ConsentInput {
  user_id: string;
  kind: string;              // "terms" | "auto_renewal" | "sms_optin" | "email_optin" | "earnings_disclosure" | "age_18plus" | "social_posting" | ...
  version?: string | null;   // version of the doc/disclosure shown
  accepted: boolean;
  shown?: unknown;           // snapshot of what was displayed to the user
  ip?: string | null;
  meta?: Record<string, unknown>;
}

/** Append a consent/disclosure record (append-only). */
export async function recordConsent(input: ConsentInput) {
  return await db.create("ConsentRecord", {
    user_id: input.user_id,
    kind: input.kind,
    version: input.version ?? null,
    accepted: !!input.accepted,
    shown: input.shown ?? null,
    ip: input.ip ?? null,
    meta: input.meta ?? {},
    at: new Date().toISOString(),
  }, input.user_id);
}

/** The most recent record for (user, kind), or null. */
export async function latestConsent(userId: string, kind: string) {
  const rows = await db.filter("ConsentRecord", { user_id: userId, kind }, "-created_date", 1) as Record<string, unknown>[];
  return (rows || [])[0] ?? null;
}

/** Has the user currently accepted `kind` (optionally at a specific version)? */
export async function hasConsented(userId: string, kind: string, version?: string): Promise<boolean> {
  const latest = await latestConsent(userId, kind);
  if (!latest || latest.accepted !== true) return false;
  if (version != null && String(latest.version ?? "") !== String(version)) return false;
  return true;
}
