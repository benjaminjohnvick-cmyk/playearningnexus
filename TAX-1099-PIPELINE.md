# Tax & 1099 Pipeline

*Collecting W-9s, tracking reportable payouts, applying backup withholding, and exporting filing-ready 1099-NEC
records for the real-cash partner payouts (developers, affiliates, creators). Tracks state; the actual filing
goes through your provider. Not tax or legal advice.*

## Why this exists

Users are closed-loop (non-cashable Site Cash) and generate no 1099s. But **business partners** — developers,
affiliates, creators — are paid **real cash** (PayPal/Venmo/Cash App/etc., 1099-reported per the payments
architecture). U.S. rules require: collect a **W-9** from each payee, track **reportable payments** per person
per year, apply **24% backup withholding** to anyone paid at/over the **$600** 1099-NEC threshold **without** a
W-9 on file, and file a **1099-NEC** for each qualifying recipient.

## The flow

1. **Collect the W-9** — `submitTaxInfo` stores a `TaxProfile` (legal name, classification, TIN, address,
   certification), sets `w9_on_file`, and logs the certification to the consent ledger. The raw TIN is sensitive
   PII: only the masked TIN is ever surfaced back; production should encrypt at rest or hand TINs to the filing
   provider.
2. **Track reportable payouts** — every cash payout writes a `MoneyLedgerEntry` of a reportable type; per-user
   yearly totals are the box-1 nonemployee-compensation figure.
3. **Backup withholding** — `applyBackupWithholding(gross, payee)` withholds 24% (admin-tunable) when no W-9 is
   on file, and is wired into every payout rail (PayPal, Venmo, Cash App, reward, withdrawal, request). The
   withheld amount is recorded on the `Payout` (box 4).
4. **Self-service status** — `taxProfileStatus` tells a partner their W-9 state, YTD reportable vs the
   threshold, whether a W-9 is required (or being approached), and any withholding — surfaced in the **Tax
   Center** on the partner earnings dashboard so they can file a W-9 and stop withholding.
5. **File** — `tax1099Export` (admin) produces filing-ready 1099-NEC rows (box 1 gross, box 4 withheld) as JSON
   or CSV for your filing provider (e.g. Track1099). Recipients over threshold without a W-9 come back as
   `blocked` (collect a W-9 first).

## Components

- `backend/sdk/tax.ts` — thresholds, `applyBackupWithholding`, `ytdReportable`, `ytdWithheld`, `hasW9OnFile`,
  `w9Requirement`, `maskTin`, and the 1099-NEC row/CSV builders (`nec1099Row`, `nec1099Csv`).
- `backend/functions/submitTaxInfo` — W-9 collection (existing).
- `backend/functions/taxProfileStatus` — the partner's self-service W-9/YTD status (new).
- `backend/functions/tax1099Export` — admin filing-ready 1099-NEC export, JSON or CSV (new).
- `backend/functions/taxComplianceReport` — admin per-year who-needs-1099 / who-needs-withholding summary (existing).
- `src/components/payout/TaxCenter.jsx` — the partner-facing W-9 status + submission UI (new), on the developer
  earnings dashboard.
- `TaxProfile` entity — now owner-scoped RLS (a partner reads only their own; admin via service role).
- Settings (Compliance & Legal): `TAX_1099_THRESHOLD` ($600), `TAX_BACKUP_WITHHOLDING_RATE` (0.24).

## Security notes

- The full TIN is included in an export ONLY with `include_full_tin:true` (admin-only) for handoff to the filing
  provider; everywhere else it's masked (`***-**-1234`).
- `TaxProfile` is owner-scoped: a user can only read their own profile via entity routes; aggregation runs under
  the service role.
- This module tracks and reports; it does not itself transmit filings. Route the export to a compliant 1099
  provider, and consult a tax professional for thresholds, state filing, and TIN matching.
