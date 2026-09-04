// premium-autorenew.ts — the DEFAULT auto-renewal posture for the consumer PREMIUM membership (owner request),
// mirroring the Tier 2/3 advertiser posture. A membership defaults to auto-renew (up to PREMIUM_AUTORENEW_
// TERM_YEARS) UNLESS the member opts out, with an ADVANCE reminder (default 30 days) AND a FINAL warning
// (default 24 hours) by email + account inbox before each renewal.
//
// ‼ HIGHER COMPLIANCE RISK THAN THE B2B SEATS. Premium is a CONSUMER subscription, so consumer auto-renewal
// laws apply squarely: California's ARL (express affirmative consent, click-to-cancel, advance renewal
// reminder ~15–45 days for annual terms), other state ARLs, and federal ROSCA. A 24-hour-only notice is NOT
// sufficient — the advance reminder is the notice that matters. See TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md.
// OFF by default and counsel-gated (PREMIUM_AUTORENEW_ENABLED). Nothing here charges: a renewal is recorded as
// INTENT only; the actual charge + term extension run through the normal gated payment path.
//
// Timing is keyed off the membership's `expires_at` (not an anniversary), so once the payment path extends the
// term the next cycle re-arms automatically. Pure helpers only; the sweep passes in the record + clock.
import { snapBool, snapNumber } from "./settings.ts";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// deno-lint-ignore no-explicit-any
type Rec = Record<string, any>;

export const premiumAutoRenewEnabled = () => snapBool("PREMIUM_AUTORENEW_ENABLED", false);
export const premiumAutoRenewDefaultEnrolled = () => snapBool("PREMIUM_AUTORENEW_DEFAULT_ENROLLED", true);
export const premiumAutoRenewTermYears = () => Math.max(1, Math.round(snapNumber("PREMIUM_AUTORENEW_TERM_YEARS", 5)));
export const premiumAutoRenewAdvanceDays = () => Math.max(0, Math.round(snapNumber("PREMIUM_AUTORENEW_ADVANCE_NOTICE_DAYS", 30)));
export const premiumAutoRenewFinalHours = () => Math.max(0, Math.round(snapNumber("PREMIUM_AUTORENEW_FINAL_NOTICE_HOURS", 24)));

/** STRICTEST-STANDARD consent gate (California ARL / ROSCA): a CONSUMER membership auto-renews only with
 *  express affirmative consent on file (auto_renew_consent). Consumer subscriptions are the highest-risk case,
 *  so this defaults ON — no consent means "notify, but never auto-charge". */
export const premiumAutoRenewRequireConsent = () => snapBool("PREMIUM_AUTORENEW_REQUIRE_CONSENT", true);
export function premiumHasConsent(rec: Rec): boolean {
  return rec?.auto_renew_consent === true || rec?.auto_renew_optin === true;
}

/** Enrolled = subject to auto-renew. Opt-out posture: enrolled unless auto_renew_optout. Opt-in posture:
 *  only if auto_renew_optin. An explicit opt-out always wins. Under the strict consent gate, enrolled only
 *  when express auto-renew consent is on file. */
export function premiumIsEnrolled(rec: Rec): boolean {
  if (rec?.auto_renew_optout === true) return false;
  if (premiumAutoRenewRequireConsent() && !premiumHasConsent(rec)) return false; // strictest: no consent → no auto-charge
  if (premiumAutoRenewDefaultEnrolled()) return true;
  return rec?.auto_renew_optin === true;
}

export function renewalsDone(rec: Rec): number {
  return Math.max(0, Math.floor(Number(rec?.autorenew_renewals) || 0));
}

export interface PremiumRenewalTiming {
  active: boolean;          // membership is active with a valid expiry
  enrolled: boolean;
  in_term: boolean;         // under the renewal-count cap
  expires_key: string;      // the expires_at this cycle is keyed to
  renew_at_ms: number;
  advance_at_ms: number;
  final_at_ms: number;
  due_advance: boolean;
  due_final: boolean;
  due_renewal: boolean;
}

/** Compute the renewal timing for a membership at `nowMs`. Pure. Keyed off `expires_at`. */
export function premiumRenewalTiming(rec: Rec, nowMs: number): PremiumRenewalTiming {
  const statusOk = String(rec?.status ?? "active") === "active";
  const expIso = String(rec?.expires_at ?? "");
  const renewAt = Date.parse(expIso);
  const valid = statusOk && !Number.isNaN(renewAt);
  const enrolled = premiumIsEnrolled(rec);
  const inTerm = renewalsDone(rec) < (premiumAutoRenewTermYears() - 1); // year 1 + (term-1) renewals
  const advanceAt = renewAt - premiumAutoRenewAdvanceDays() * DAY_MS;
  const finalAt = renewAt - premiumAutoRenewFinalHours() * HOUR_MS;
  const key = expIso;
  return {
    active: valid, enrolled, in_term: inTerm, expires_key: key,
    renew_at_ms: renewAt, advance_at_ms: advanceAt, final_at_ms: finalAt,
    due_advance: valid && enrolled && inTerm && nowMs >= advanceAt && String(rec?.autorenew_advance_for ?? "") !== key,
    due_final: valid && enrolled && inTerm && nowMs >= finalAt && String(rec?.autorenew_final_for ?? "") !== key,
    due_renewal: valid && enrolled && inTerm && nowMs >= renewAt && String(rec?.autorenew_intent_for ?? "") !== key,
  };
}

// ── Notice copy (email + inbox) ─────────────────────────────────────────────────────────────────────────
export interface NoticeCopy { subject: string; title: string; message: string; body: string; }

export function premiumAdvanceNoticeCopy(opts: { name: string; renewOnISO: string; advanceDays: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  return {
    subject: `Your GamerGain Premium renews on ${date} — ${opts.advanceDays}-day notice`,
    title: `⏰ Premium renews in ~${opts.advanceDays} days`,
    message: `Your Premium membership is set to auto-renew on ${date}. You can turn off auto-renew any time before then in your account settings — no charge if you cancel.`,
    body: `Hi ${opts.name || "there"},\n\nThis is your advance renewal reminder: your GamerGain Premium membership is scheduled to auto-renew on ${date}.\n\nYou can turn off auto-renew (cancel) at any time before ${date} from your account settings — the same place you signed up. If you cancel, nothing is charged and your benefits simply end at the current expiry.\n\nYou'll also get a short final reminder before the renewal date.\n\n— Get Goods Gratis (Free)`,
  };
}

export function premiumFinalNoticeCopy(opts: { name: string; renewOnISO: string; finalHours: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  return {
    subject: `Final notice: your GamerGain Premium renews in ~${opts.finalHours} hours`,
    title: `🔔 Final reminder — Premium renews soon`,
    message: `Final reminder: your Premium membership auto-renews on ${date}. To cancel, turn off auto-renew now in your account settings — no charge if you cancel.`,
    body: `Hi ${opts.name || "there"},\n\nFinal reminder (about ${opts.finalHours} hours out): your GamerGain Premium membership auto-renews on ${date}. If you don't want to renew, turn off auto-renew now from your account settings — if you cancel, nothing is charged.\n\n— Get Goods Gratis (Free)`,
  };
}
