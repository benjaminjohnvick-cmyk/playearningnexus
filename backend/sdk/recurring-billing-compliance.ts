// recurring-billing-compliance.ts — one shared strict-standard guard for EVERY recurring-charge surface
// (PPC Grid Stripe subscriptions, generic Subscription auto-renew, BusinessSubscription monthly rebill, and any
// future one). Implements the platform's strictest-standard compliance policy for negative-option billing:
//   • express affirmative consent to the recurring terms must be on file before anything auto-charges;
//   • an advance reminder (in the 15–45 day legal window, default 30) AND a final warning (default 24h) go out
//     before each renewal, on two channels (email + account inbox);
//   • the holder can always opt out (click-to-cancel), effective next cycle.
// See STRICTEST-STANDARD-COMPLIANCE-POLICY.md + TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md.
//
// Pure helpers only (no I/O). Each billing codepath calls the guard before it charges, and the sweeps use the
// timing + copy helpers to send notices. Depends only on settings.ts.
import { snapBool, snapNumber } from "./settings.ts";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// deno-lint-ignore no-explicit-any
type Rec = Record<string, any>;

export const recurringStrict = () => snapBool("RECURRING_BILLING_STRICT_ENABLED", true);
export const recurringRequireConsent = () => snapBool("RECURRING_BILLING_REQUIRE_CONSENT", true);
export const recurringAdvanceDays = () => Math.max(0, Math.round(snapNumber("RECURRING_BILLING_ADVANCE_NOTICE_DAYS", 30)));
export const recurringFinalHours = () => Math.max(0, Math.round(snapNumber("RECURRING_BILLING_FINAL_NOTICE_HOURS", 24)));

/** Express recurring/auto-renew consent on file? Accepts any of the consent flags surfaces use. */
export function recurringHasConsent(rec: Rec): boolean {
  return rec?.auto_renew_consent === true || rec?.recurring_consent === true || rec?.auto_renew_optin === true;
}
export function recurringOptedOut(rec: Rec): boolean {
  return rec?.auto_renew_optout === true;
}

/**
 * The one gate every auto-charge must pass. Returns null when it's OK to auto-charge, or a human reason string
 * when it must be BLOCKED (opted out, or — under the strict consent requirement — no express consent on file).
 * Enrollment (the surface's own "auto_renew" signal) is the caller's concern; this enforces consent + opt-out.
 */
export function recurringChargeBlockedReason(rec: Rec): string | null {
  if (recurringOptedOut(rec)) return "holder opted out of auto-renewal";
  if (recurringStrict() && recurringRequireConsent() && !recurringHasConsent(rec)) {
    return "no express auto-renew consent on file (strict standard blocks the auto-charge)";
  }
  return null;
}

export interface RecurringTiming {
  key: string; renew_at_ms: number; advance_at_ms: number; final_at_ms: number;
  due_advance: boolean; due_final: boolean; due_renewal: boolean;
}
/** Notice/renewal timing keyed off the surface's next-charge date (ISO). Idempotent via *_for fields set to
 *  the same key. Pure. */
export function recurringTiming(rec: Rec, nowMs: number, renewAtISO: string): RecurringTiming {
  const renewAt = Date.parse(renewAtISO);
  const valid = !Number.isNaN(renewAt);
  const advanceAt = renewAt - recurringAdvanceDays() * DAY_MS;
  const finalAt = renewAt - recurringFinalHours() * HOUR_MS;
  const key = renewAtISO;
  return {
    key, renew_at_ms: renewAt, advance_at_ms: advanceAt, final_at_ms: finalAt,
    due_advance: valid && nowMs >= advanceAt && String(rec?.autorenew_advance_for ?? "") !== key,
    due_final: valid && nowMs >= finalAt && String(rec?.autorenew_final_for ?? "") !== key,
    due_renewal: valid && nowMs >= renewAt && String(rec?.autorenew_intent_for ?? "") !== key,
  };
}

// ── Generalized notice copy (email + inbox) ─────────────────────────────────────────────────────────────
export interface NoticeCopy { subject: string; title: string; message: string; body: string; }

function money(amountUsd?: number): string {
  return amountUsd && amountUsd > 0 ? `$${Number(amountUsd).toLocaleString()}` : "the standard rate";
}

export function recurringAdvanceNoticeCopy(opts: { name: string; product: string; renewOnISO: string; amountUsd?: number; advanceDays: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  const amt = money(opts.amountUsd);
  return {
    subject: `Your ${opts.product} renews on ${date} — ${opts.advanceDays}-day notice`,
    title: `⏰ ${opts.product} renews in ~${opts.advanceDays} days`,
    message: `Your ${opts.product} is set to auto-renew on ${date} at ${amt}. You can cancel any time before then in your settings — no charge if you cancel.`,
    body: `Hi ${opts.name || "there"},\n\nThis is your advance renewal reminder: your ${opts.product} is scheduled to auto-renew on ${date} at ${amt}.\n\nYou can cancel (turn off auto-renew) at any time before ${date} from your account settings — the same place you signed up. If you cancel, nothing is charged.\n\nYou'll also get a short final reminder before the renewal date.\n\n— Get Goods Gratis (Free)`,
  };
}

export function recurringFinalNoticeCopy(opts: { name: string; product: string; renewOnISO: string; amountUsd?: number; finalHours: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  const amt = money(opts.amountUsd);
  return {
    subject: `Final notice: your ${opts.product} renews in ~${opts.finalHours} hours`,
    title: `🔔 Final reminder — ${opts.product} renews soon`,
    message: `Final reminder: your ${opts.product} auto-renews on ${date} at ${amt}. To cancel, turn off auto-renew now in your settings — no charge if you cancel.`,
    body: `Hi ${opts.name || "there"},\n\nFinal reminder (about ${opts.finalHours} hours out): your ${opts.product} auto-renews on ${date} at ${amt}. If you don't want to renew, cancel now from your account settings — if you cancel, nothing is charged.\n\n— Get Goods Gratis (Free)`,
  };
}
