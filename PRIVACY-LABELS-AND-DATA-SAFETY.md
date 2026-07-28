# Privacy Labels (Apple) & Data Safety (Google Play)

Prefilled answers for the two store privacy questionnaires, consistent with the Privacy Policy. Confirm
against your final integrations before submitting. Not legal advice.

## Apple — App Privacy ("Nutrition Label")

Data used to **track** you: **None** (do not enable cross-app tracking / IDFA unless you add an ad SDK).

Data **linked to you**:
- Contact Info → Email address (App Functionality, Account)
- User Content → Customer support messages, other user content (App Functionality)
- Identifiers → User ID (App Functionality)
- Purchases → Purchase history / points activity (App Functionality)
- Usage Data → Product interaction (App Functionality, Analytics, **Product Personalization**)
- Location → Coarse location (from IP, App Functionality — localization) 
- Diagnostics → Crash/performance data (App Functionality)

Data **not linked to you**: Diagnostics (if collected anonymously).

Notes: no health, financial account numbers, precise GPS, contacts, photos, or browsing history of
other apps are collected. Behavioral/usage data supports personalization and can be turned off by the
user.

## Google Play — Data Safety form

Does the app collect or share user data? **Yes, collects.** Shared with third parties? **Yes** (service
providers/processors only; see below). Is data encrypted in transit? **Yes.** Can users request
deletion? **Yes** (in-app account deletion).

Data types collected:
- **Personal info:** Email address (collected, linked, required) — Account management.
- **Personal info:** Name/display name (collected, linked, optional) — Account management.
- **Location:** Approximate location (collected, linked) — App functionality (localization). Derived
  from IP, not device GPS.
- **Financial info:** Purchase history / in-app points activity (collected, linked) — App functionality.
- **App activity:** App interactions, in-app search history (collected, linked) — App functionality,
  Analytics, Personalization.
- **App info & performance:** Crash logs, diagnostics (collected) — App functionality.
- **Device or other IDs:** User/device identifier (collected, linked) — App functionality.

Purposes to select: App functionality; Analytics; Personalization; Account management; Fraud prevention,
security, and compliance.

Sharing: shared only with **processors/service providers** acting on our behalf (hosting, payments,
email/SMS, AI/LLM & image generation, IP-geolocation, exchange rates). Not sold. Not used for
third-party advertising in this build.

Security practices: data encrypted in transit; users can request deletion in-app; app follows a
families/child-safety exclusion (18+).

## Consistency checklist
- Every item above is described in `PRIVACY-POLICY.md` and `SUBPROCESSORS.md`.
- If you later add an ad SDK, analytics that tracks across apps, SMS marketing, or cash-out (financial
  account data), **update both questionnaires** and the Privacy Policy before shipping that build.
