# Counsel Note — Using Collected Data to Train a Custom Model (2026-09-12)

*Plain-English brief for legal review of the model-training data pipeline. Not legal advice — it flags the
questions for counsel. The feature is **built but the EXPORT is gated OFF** (`MODEL_TRAINING_EXPORT_ENABLED`,
default 0, counsel-gated in `counselFeatureGate`). Nothing leaves the server for model-training use until an
admin enables it with a `COUNSEL_APPROVED` acknowledgment.*

## 0. Read first — what's on vs. off

- **ON (safe, counts only):** `MODEL_TRAINING_ENABLED` (default 1) assembles the platform's collected records
  into a model-ready dataset **in memory** and reports **readiness counts** (how many labeled examples exist,
  by type and domain). No example content leaves the server. This is what powers the "Custom-model readiness"
  number on the Data-Driven Coverage dashboard.
- **OFF, counsel-gated:** `MODEL_TRAINING_EXPORT_ENABLED` (default 0). Only when this is on can an admin
  **export** the actual example content (JSONL) to train a custom model with an external provider.

## 1. What the dataset actually contains

The examples are **operational**, not user profiles. Three sources, all first-party and PII-minimized:

- **Decision labels** — the AI proposed an action in a domain (context) and a human approved or rejected it.
  Stored fields: domain, the AI's proposed action, the reason, and the approve/reject label. Subject/user
  identifiers are **dropped**.
- **Optimization rewards** — a setting change (from → to), its objective metric, and the measured win/loss/lift.
  No user data.
- **Feature quality** — per-feature success/accuracy/satisfaction from the AI-performance log; free-text input
  summaries are **truncated** and carry no identifiers.

The builder strips user/subject ids and truncates free text specifically so the export is minimized.

## 2. Questions for counsel

1. **Privacy-policy disclosure.** Before we enable the export and train a model, must the privacy policy
   explicitly disclose that collected data (in this minimized, operational form) may be used to train an
   internal model? We assume **yes** and will add the disclosure — please confirm the wording and scope.
2. **Consent basis.** Our collection is already first-party and consent-gated (see `FOUNDING-DATA-*` and the
   privacy/cookie notices). Does using that data to train a model require a **separate or additional consent**,
   or is it covered by the existing first-party-analytics consent if disclosed? Any jurisdictions (EU/UK GDPR
   purpose-limitation, CCPA/CPRA) where model-training is a distinct purpose needing its own opt-in?
3. **Minimization sufficiency.** Is dropping identifiers + truncating free text adequate, or do you want a
   stricter scrub (e.g., a denylist of fields, or a review step) before any export?
4. **Automated-decision-making rules.** If a future custom model drives decisions, do GDPR Art. 22 (automated
   decisions) / emerging state AI rules require specific disclosures, human-review rights, or impact
   assessments? (The permanent human gates on money/identity/legal already keep those decisions human-approved.)
5. **Retention / deletion.** How should exported training sets and any resulting model be handled under a
   user's deletion request (DSAR) — given the exported examples are de-identified operational records?

## 3. Recommendation pending review

- Keep `MODEL_TRAINING_EXPORT_ENABLED` **OFF and counsel-gated** (already implemented).
- Leave `MODEL_TRAINING_ENABLED` (readiness counts, no content export) on — it surfaces the readiness number
  without moving any data.
- Before enabling the export: add the privacy-policy disclosure counsel approves, confirm the consent basis,
  and (if counsel wants) tighten the minimization. Then enable via the Setup Wizard with `COUNSEL_APPROVED`.

*Note: training a model itself is an external step with a training provider — the platform builds the dataset
and measures readiness; it does not train in-process. This note is about the data, not the training vendor.*
