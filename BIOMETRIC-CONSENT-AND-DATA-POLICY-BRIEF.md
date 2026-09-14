# Biometric Consent & Data Policy — Counsel Brief

> **⚠️ NOT LEGAL ADVICE.** An inventor-prepared brief on the biometric-privacy policy and consent flow counsel
> should produce before any voice or facial data is processed. Triggered by Buddy Chat voice features and any
> step-up/liveness auth. Prepared 2026-09-14. See `DATA-COLLECTION-BRIEF-FOR-COUNSEL`, `BUDDY-CHAT-LEGAL-BRIEF`,
> `BIOMETRIC-AND-STEP-UP-AUTH-COUNSEL-NOTE`.

## Why this matters

Voice recordings and any faceprint/liveness data can be **biometric identifiers** under Illinois **BIPA**, Texas
**CUBI**, and Washington's biometric law. BIPA in particular carries a **private right of action** and statutory
damages, and requires a **written, publicly available policy**, **informed written consent before collection**,
and a **retention/destruction schedule** — non-compliance is a leading source of privacy class actions.

## What counsel should produce

- **Public biometric privacy policy** — what biometric data (if any) is collected, the specific purpose, the
  **retention schedule**, and the **destruction timeline** (e.g. destroy when the purpose is satisfied or within
  a set period).
- **Standalone written consent** — separate, affirmative, pre-collection consent (not bundled into the general
  Privacy Policy), logged to the consent ledger with timestamp + version.
- **No-sale/no-disclosure commitment** and vendor flow-downs if any processor touches the data.
- **Design confirmation** — whether voice is transcribed-and-discarded vs. stored; whether any faceprint is ever
  created; if the feature can avoid creating a biometric identifier altogether, prefer that (the safest posture).

## Decisions for counsel

Whether the current/planned feature set actually creates a biometric identifier (if not, say so plainly and gate
it so it can't); retention period; which states are in scope; whether to geo-gate the feature away from the
highest-risk states until the policy and consent are live. Gate: the voice/biometric feature ships **OFF** until
this is cleared.

*Not legal advice. Related: `DATA-PROCESSING-AND-SUBPROCESSOR-BRIEF`, `PRIVACY-POLICY`, `BUDDY-CHAT-LEGAL-BRIEF`.*
