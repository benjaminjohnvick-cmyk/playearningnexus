# Data Processing Agreement & Sub-processors — Counsel Brief

> **⚠️ NOT LEGAL ADVICE.** An inventor-prepared brief on the data-processing contract stack counsel should
> produce to support the privacy posture. Complements the data-collection brief with the *contractual* pieces.
> Prepared 2026-09-14. See `Data Collection\DATA-COLLECTION-BRIEF-FOR-COUNSEL`, `SUBPROCESSORS`, `PRIVACY-POLICY`.

## Why this matters

Under GDPR/UK GDPR and US state privacy laws, the company (controller) must have **data processing agreements**
with every vendor that handles personal data (processor), maintain a **sub-processor list**, document processing
in a **RoPA**, run a **DPIA** for high-risk processing, and use a valid **international transfer mechanism**.
These are contract/records deliverables distinct from the consumer-facing Privacy Policy.

## What counsel should produce

- **DPA template** (company-as-controller → vendor-as-processor) — processing scope, security measures, breach
  notice, sub-processing consent, audit, deletion/return, and controller instructions.
- **Standard Contractual Clauses / UK IDTA** attached where data leaves the EEA/UK.
- **Maintained sub-processor list** (public) + a change-notification mechanism (`SUBPROCESSORS`).
- **Records of Processing Activities (RoPA)** and a **DPIA** for the profiling + AI-model + session-screenshot
  processing (the DPIA is the risk assessment several laws now require).
- **EU/UK Article 27 representative** appointment if serving those markets.

## Decisions for counsel

Controller vs. processor characterization for each data flow (esp. the founding "collect everything" first-party
data feeding the AI model); which vendors need a DPA vs. are joint-controllers; transfer mechanism per region;
DPIA scope and who signs off; retention alignment with the biometric and records-retention policies.

*Not legal advice. Related: `Data Collection\DATA-COLLECTION-BRIEF-FOR-COUNSEL`, `BIOMETRIC-CONSENT-AND-DATA-POLICY-BRIEF`, `MODEL-TRAINING-DATA-COUNSEL-NOTE`, `GLOBAL-LAUNCH-LEGAL-STRATEGY-BRIEF`.*
