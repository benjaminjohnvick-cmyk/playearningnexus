// tier-autorenew.ts — the DEFAULT auto-renewal posture for Tier 2 & Tier 3 advertiser seats (owner request).
// A seat defaults to a multi-year term (up to TIER_AUTORENEW_TERM_YEARS, default 5) that renews one year at a
// time — results permitting — UNLESS the holder opts out at year end. Each renewal is preceded by an ADVANCE
// reminder (default 30 days) AND a FINAL warning (default 24 hours), both sent by email + account inbox.
//
// COMPLIANCE POSTURE (see TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md): this is a NEGATIVE-OPTION (opt-out)
// arrangement, which FTC/ROSCA and state auto-renewal laws regulate tightly. A 24-hour-only notice is NOT
// sufficient for an annual renewal (California ARL expects ~15–45 days' advance reminder), which is exactly
// why the advance reminder exists and is the primary notice. The whole posture is OFF by default and
// counsel-gated (TIER_AUTORENEW_ENABLED). Nothing here charges: a renewal is recorded as INTENT only; the
// actual charge still runs through the normal gated payment path.
//
// Pure helpers only (no I/O) — the sweep function passes in the records + clock. Depends only on settings.ts.
import { snapBool, snapNumber, snapList } from "./settings.ts";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const YEAR_MS = 365.25 * DAY_MS;

// deno-lint-ignore no-explicit-any
type Rec = Record<string, any>;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const autoRenewEnabled = () => snapBool("TIER_AUTORENEW_ENABLED", false);
export const autoRenewDefaultEnrolled = () => snapBool("TIER_AUTORENEW_DEFAULT_ENROLLED", true);
export const autoRenewTermYears = () => Math.max(1, Math.round(snapNumber("TIER_AUTORENEW_TERM_YEARS", 5)));
export const autoRenewResultsGated = () => snapBool("TIER_AUTORENEW_RESULTS_GATED", true);
export const autoRenewResultsMult = () => Math.max(0, snapNumber("TIER_AUTORENEW_RESULTS_MULT", 1));
export const autoRenewAdvanceDays = () => Math.max(0, Math.round(snapNumber("TIER_AUTORENEW_ADVANCE_NOTICE_DAYS", 30)));
export const autoRenewFinalHours = () => Math.max(0, Math.round(snapNumber("TIER_AUTORENEW_FINAL_NOTICE_HOURS", 24)));

/** Tiers the posture applies to (default 2 & 3). */
export function autoRenewTiers(): Set<number> {
  const raw = snapList("TIER_AUTORENEW_TIERS");
  const list = (raw.length ? raw : ["2", "3"]).map((s) => normalizeTierNum(s)).filter((n) => n > 0);
  return new Set(list.length ? list : [2, 3]);
}

/** Parse "Tier 2" / "tier_2" / "2" / 2 → 2. Unknown → 0. */
export function normalizeTierNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const m = String(v ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** The tier of a seat record, from whichever field holds it. */
export function recTier(rec: Rec): number {
  return normalizeTierNum(rec?.current_tier ?? rec?.tier ?? rec?.tier_level ?? rec?.plan_tier);
}

export function appliesToTier(rec: Rec): boolean {
  return autoRenewTiers().has(recTier(rec));
}

/** STRICTEST-STANDARD consent gate: even under the opt-out default, a seat auto-renews only when express
 *  affirmative consent to the auto-renew terms is on file (auto_renew_consent) — this is what California's ARL
 *  / ROSCA require for any auto-renewal. ON by default; a losing this gate means "notify, but never auto-charge
 *  without consent". Counsel can relax it, but the strict default keeps us on the right side of the law. */
export const autoRenewRequireConsent = () => snapBool("TIER_AUTORENEW_REQUIRE_CONSENT", true);
export function hasAutoRenewConsent(rec: Rec): boolean {
  return rec?.auto_renew_consent === true || rec?.auto_renew_optin === true;
}

/** Enrolled = subject to auto-renewal. Opt-out posture: enrolled unless auto_renew_optout. Opt-in posture:
 *  only if auto_renew_optin. An explicit per-seat auto_renew_optout always wins. And under the strict consent
 *  gate, a seat is enrolled only if express auto-renew consent is on file. */
export function isEnrolled(rec: Rec): boolean {
  if (rec?.auto_renew_optout === true) return false;
  if (autoRenewRequireConsent() && !hasAutoRenewConsent(rec)) return false; // strictest: no consent → no auto-charge
  if (autoRenewDefaultEnrolled()) return true;
  return rec?.auto_renew_optin === true;
}

/** Term start in ms, from the seat's start/purchase timestamp. NaN if unknown. */
export function termStartMs(rec: Rec): number {
  return Date.parse(String(rec?.autorenew_term_started_at ?? rec?.tier_started_at ?? rec?.purchased_at ?? rec?.started_at ?? rec?.created_date ?? ""));
}

/** How many renewals have already been applied to this seat. */
export function renewalsDone(rec: Rec): number {
  return Math.max(0, Math.floor(Number(rec?.autorenew_years_renewed) || 0));
}

export interface RenewalTiming {
  applies: boolean;          // seat is in an autorenew tier
  enrolled: boolean;         // subject to auto-renew (not opted out)
  in_term: boolean;          // still under the term-year cap
  target_index: number;      // the upcoming renewal number (1 = first renewal, into year 2)
  renew_at_ms: number;       // when the next renewal falls
  advance_at_ms: number;     // when the advance reminder is due
  final_at_ms: number;       // when the final warning is due
  due_advance: boolean;      // advance reminder should be sent now (and hasn't been for this cycle)
  due_final: boolean;        // final warning should be sent now (and hasn't been for this cycle)
  due_renewal: boolean;      // the renewal moment has arrived (and hasn't been applied for this cycle)
}

/** Compute the renewal timing for a seat at `nowMs`. Pure. */
export function renewalTiming(rec: Rec, nowMs: number): RenewalTiming {
  const applies = appliesToTier(rec);
  const enrolled = isEnrolled(rec);
  const start = termStartMs(rec);
  const term = autoRenewTermYears();
  const done = renewalsDone(rec);
  const targetIndex = done + 1;                 // the renewal we're approaching
  const inTerm = targetIndex < term;            // year 1 + (term-1) renewals = term years total
  const renewAt = Number.isNaN(start) ? NaN : start + targetIndex * YEAR_MS;
  const advanceAt = renewAt - autoRenewAdvanceDays() * DAY_MS;
  const finalAt = renewAt - autoRenewFinalHours() * HOUR_MS;
  const validClock = !Number.isNaN(renewAt);
  const advanceFor = Math.floor(Number(rec?.autorenew_advance_for) || 0);
  const finalFor = Math.floor(Number(rec?.autorenew_final_for) || 0);
  return {
    applies, enrolled, in_term: inTerm, target_index: targetIndex,
    renew_at_ms: renewAt, advance_at_ms: advanceAt, final_at_ms: finalAt,
    due_advance: applies && enrolled && inTerm && validClock && nowMs >= advanceAt && advanceFor < targetIndex,
    due_final: applies && enrolled && inTerm && validClock && nowMs >= finalAt && finalFor < targetIndex,
    due_renewal: applies && enrolled && inTerm && validClock && nowMs >= renewAt && done < targetIndex,
  };
}

/** The ISO start of the year whose results gate the upcoming renewal (the year now ending). */
export function currentYearStartISO(rec: Rec): string {
  const start = termStartMs(rec);
  if (Number.isNaN(start)) return new Date(Date.now() - YEAR_MS).toISOString();
  return new Date(start + renewalsDone(rec) * YEAR_MS).toISOString();
}

// ── Notice copy (email + inbox) ─────────────────────────────────────────────────────────────────────────
export interface NoticeCopy { subject: string; title: string; message: string; body: string; }

export function advanceNoticeCopy(opts: { name: string; tier: number; yearNumber: number; renewOnISO: string; costUsd: number; advanceDays: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  const cost = opts.costUsd > 0 ? `$${opts.costUsd.toLocaleString()}` : "the standard rate";
  const subject = `Your Tier ${opts.tier} advertising renews on ${date} — ${opts.advanceDays}-day notice`;
  const title = `⏰ Tier ${opts.tier} renewal in ~${opts.advanceDays} days`;
  const message = `Your Tier ${opts.tier} advertising is set to auto-renew into year ${opts.yearNumber} on ${date} at ${cost}, as long as your results warrant it. You can opt out any time before then in your advertiser settings — no charge if you opt out.`;
  const body = `Hi ${opts.name || "there"},\n\nThis is your advance renewal reminder.\n\nYour Tier ${opts.tier} advertising seat is scheduled to auto-renew into year ${opts.yearNumber} on ${date} at ${cost} — but only if your prior-year results warrant it (a year that doesn't perform is not renewed).\n\nYou can opt out of this renewal at any time before ${date} from your advertiser settings. If you opt out, nothing is charged and your current term simply ends.\n\nYou'll also receive a final reminder shortly before the renewal date.\n\n— Get Goods Gratis (Free)`;
  return { subject, title, message, body };
}

export function finalNoticeCopy(opts: { name: string; tier: number; yearNumber: number; renewOnISO: string; costUsd: number; finalHours: number }): NoticeCopy {
  const date = opts.renewOnISO.slice(0, 10);
  const cost = opts.costUsd > 0 ? `$${opts.costUsd.toLocaleString()}` : "the standard rate";
  const subject = `Final notice: your Tier ${opts.tier} advertising renews in ~${opts.finalHours} hours`;
  const title = `🔔 Final reminder — Tier ${opts.tier} renews soon`;
  const message = `Final reminder: your Tier ${opts.tier} advertising auto-renews into year ${opts.yearNumber} on ${date} at ${cost} (results permitting). To opt out, do so now in your advertiser settings — no charge if you opt out.`;
  const body = `Hi ${opts.name || "there"},\n\nThis is your final reminder (about ${opts.finalHours} hours out).\n\nYour Tier ${opts.tier} advertising seat auto-renews into year ${opts.yearNumber} on ${date} at ${cost}, results permitting. If you do not want to renew, opt out now from your advertiser settings — if you opt out, nothing is charged.\n\n— Get Goods Gratis (Free)`;
  return { subject, title, message, body };
}
