// Tax / 1099 helpers.
//
// Reportable income = payments made TO a person for the year. Once a payee crosses
// REPORTABLE_THRESHOLD ($600 default, 1099-NEC), they need a 1099 — and if there's no valid W-9 on
// file, backup withholding (24%) applies until one is collected.

import { snapNumber } from "./settings.ts";
export const REPORTABLE_THRESHOLD = Number(Deno.env.get("TAX_1099_THRESHOLD") ?? "600");
export const BACKUP_WITHHOLDING_RATE = Number(Deno.env.get("TAX_BACKUP_WITHHOLDING_RATE") ?? "0.24");
/** Live, admin-adjustable getters (DB override → env → default). */
export function reportableThreshold(): number { return snapNumber("TAX_1099_THRESHOLD", REPORTABLE_THRESHOLD); }
export function backupWithholdingRate(): number { return snapNumber("TAX_BACKUP_WITHHOLDING_RATE", BACKUP_WITHHOLDING_RATE); }

// MoneyLedgerEntry types that count as reportable payments to a person.
export const REPORTABLE_PAYOUT_TYPES = [
  "payout_paypal", "payout_request", "withdrawal_request",
  "creator_payout", "affiliate_payout", "referral_payout",
];

/** Mask a TIN for display (never surface the full number in reports). */
export function maskTin(tin?: string | null): string | null {
  if (!tin) return null;
  const s = String(tin).replace(/\D/g, "");
  if (s.length < 4) return "****";
  return "***-**-" + s.slice(-4);
}

export function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }

/** Backup withholding on a cash payout. If the payee has NO valid W-9 on file, withhold the backup
 *  rate (24% default, admin-adjustable); once a W-9 is on file, pay gross. Returns the split so the
 *  caller can send `net`, record `withheld`, and keep `gross` for the 1099 total. */
export function applyBackupWithholding(
  gross: number,
  payee: { w9_on_file?: boolean } | null | undefined,
): { gross: number; net: number; withheld: number; rate: number } {
  const g = round2(gross);
  const rate = payee?.w9_on_file ? 0 : backupWithholdingRate();
  const withheld = round2(g * rate);
  return { gross: g, net: round2(g - withheld), withheld, rate };
}
