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
  "payout_paypal", "payout_venmo", "payout_cashapp", "payout_request", "withdrawal_request",
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

// ── Per-user aggregation + W-9 status (back the user status endpoint and the 1099 export) ─────────────
type Dbi = {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
};

/** The 4-digit year of a ledger/payout row (from `at` or `created_date`). */
function rowYear(r: Record<string, unknown>): string {
  return String(r.at ?? r.created_date ?? r.created_at ?? "").slice(0, 4);
}

/** A payee's year-to-date REPORTABLE payouts (gross, count) — the box-1 nonemployee-compensation total. */
export async function ytdReportable(dbi: Dbi, userId: string, year: string): Promise<{ gross: number; count: number }> {
  const rows = (await dbi.filter("MoneyLedgerEntry", { user_id: String(userId) }, "-created_date", 100000).catch(() => [])) as Record<string, unknown>[];
  let gross = 0, count = 0;
  for (const e of rows) {
    if (!REPORTABLE_PAYOUT_TYPES.includes(String(e.type))) continue;
    if (rowYear(e) !== String(year)) continue;
    gross = round2(gross + Math.abs(Number(e.amount) || 0));
    count++;
  }
  return { gross, count };
}

/** A payee's year-to-date backup withholding (the box-4 federal-tax-withheld total), from Payout records. */
export async function ytdWithheld(dbi: Dbi, userId: string, year: string): Promise<number> {
  const rows = (await dbi.filter("Payout", { user_id: String(userId) }, "-created_date", 100000).catch(() => [])) as Record<string, unknown>[];
  let withheld = 0;
  for (const p of rows) {
    if (rowYear(p) !== String(year)) continue;
    withheld = round2(withheld + (Number(p.withheld_amount) || 0));
  }
  return withheld;
}

/** Is a valid W-9 on file for this payee? Checks the TaxProfile (authoritative), which submitTaxInfo sets. */
export async function hasW9OnFile(dbi: Dbi, userId: string): Promise<boolean> {
  const rows = (await dbi.filter("TaxProfile", { user_id: String(userId) }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
  return !!rows[0]?.w9_on_file;
}

/** W-9 requirement given a year's reportable gross: required at/over threshold; "approaching" within 80%. */
export function w9Requirement(gross: number, threshold = reportableThreshold()): { required: boolean; approaching: boolean; remaining_to_threshold: number } {
  const g = round2(gross), t = Math.max(0, threshold);
  return {
    required: g >= t,
    approaching: g < t && g >= t * 0.8,
    remaining_to_threshold: round2(Math.max(0, t - g)),
  };
}

/** A filing-ready 1099-NEC row for a recipient (box 1 = nonemployee compensation, box 4 = federal tax
 *  withheld). Recipient identity + FULL TIN come from the TaxProfile — export is admin-gated; downstream
 *  filing should go through a provider (e.g. Track1099). */
export interface Nec1099Row {
  recipient_user_id: string;
  recipient_name: string;
  business_name: string | null;
  tax_classification: string | null;
  tin_type: string | null;
  tin: string | null;        // full TIN — only present in the admin export; empty when include_full_tin is off
  tin_masked: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  box1_nonemployee_comp: number;
  box4_federal_tax_withheld: number;
  tax_year: string;
}
export function nec1099Row(opts: {
  userId: string; profile: Record<string, unknown> | null; box1: number; box4: number; year: string; includeFullTin: boolean;
}): Nec1099Row {
  const p = opts.profile ?? {};
  return {
    recipient_user_id: String(opts.userId),
    recipient_name: String(p.legal_name ?? ""),
    business_name: (p.business_name as string) ?? null,
    tax_classification: (p.tax_classification as string) ?? null,
    tin_type: (p.tin_type as string) ?? null,
    tin: opts.includeFullTin ? ((p.tin as string) ?? null) : null,
    tin_masked: (p.tin_masked as string) ?? maskTin(p.tin as string),
    address: (p.address as string) ?? null, city: (p.city as string) ?? null,
    state: (p.state as string) ?? null, zip: (p.zip as string) ?? null,
    box1_nonemployee_comp: round2(opts.box1),
    box4_federal_tax_withheld: round2(opts.box4),
    tax_year: String(opts.year),
  };
}

/** CSV escape + serialize 1099-NEC rows to a filing-friendly CSV string. */
export function nec1099Csv(rows: Nec1099Row[]): string {
  const cols: (keyof Nec1099Row)[] = [
    "tax_year", "recipient_name", "business_name", "tax_classification", "tin_type", "tin", "tin_masked",
    "address", "city", "state", "zip", "box1_nonemployee_comp", "box4_federal_tax_withheld",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    const needsQuote = s.indexOf(",") >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0;
    const doubled = s.split('"').join('""');
    return needsQuote ? '"' + doubled + '"' : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
