# Counsel Note — Features added 2026-09-01

Plain-English brief for legal review of two feature sets added this session. Written for an attorney;
nothing here is a legal conclusion. Both are gated OFF by default; the money model, closed-loop Site Cash,
18+ gate, answer-wall, and moderation are unchanged.

---

## A. Buddy Chat — scheduling, matching, and **browsable member profiles**

**What it does.** Buddy Chat pairs users for accountability while earning. New this session:
1. **Available to premium** as well as non-premium (optional for premium).
2. **Book your next session:** after a session, a user picks a local time to meet again the next day; the
   app auto-opens Buddy Chat at that moment and coordinates buddies across timezones (stored in UTC).
3. **Auto-match to a new buddy by KYC survey** — shared-interest scoring from first-survey answers.
4. **Browsable profiles + pick your own match** — the first (KYC) survey builds a profile other members can
   browse and pick from; picking sends an invite (never a forced pairing).

**Privacy design already in place (for your review, not as legal advice):**
- Browsing is **opt-in** — a member appears only after turning their profile public.
- A card exposes **first name + interest fields only** (interest categories, goals, game genres, shopping
  style, device). It deliberately **excludes** email, full name, free-text answers, budget/financial
  answers, age, and any custom survey field.
- All users are 18+ (existing gate). Rewards stay closed-loop; chat stays answer-walled + moderated;
  Leave/Report always work.

**Review questions for counsel:**
1. **Consent + privacy disclosure.** Does the opt-in flow + privacy policy adequately disclose that KYC
   interest data and first name become visible to other members for matching? Is separate, specific consent
   needed beyond the general KYC consent?
2. **Data minimization / purpose limitation.** KYC answers were collected for personalization/surveys; using
   them to build a member-visible matching profile is arguably a new purpose — confirm the disclosure and
   legal basis cover it (GDPR/CCPA/etc. by market).
3. **Member-to-member contact + safety.** Invites and scheduled 1:1 sessions facilitate contact between
   strangers. Confirm the moderation, report/block, and no-real-world-meetup posture is sufficient; consider
   whether any market requires more (e.g. safety disclosures).
4. **Notifications / scheduled pop-ups.** Auto-open notifications at a user-chosen time — confirm they inherit
   the platform's existing notification-consent posture.
5. **Cross-border data.** Cross-timezone matching pairs users in different countries; confirm no added
   cross-border data-transfer obligation from showing one country's member profile to another's.

---

## B. Automatic AI translation of surveys

**What it does.** The AI survey creator and the manual survey creator now auto-translate a survey (title,
every question and answer option, tips) into the languages a user/business selects, storing each as a variant
beside the original. Existing surveys can be translated later on demand.

**Integrity design already in place:** translation is **neutral and structure-preserving** — wording only;
options are never added, removed, merged, or reordered, question count is unchanged, placeholders/URLs/numbers
kept intact — so a translated survey stays unbiased and comparable to the original. Dialect-aware; bounded;
best-effort (a failed language is skipped, original intact).

**Review questions for counsel:**
1. **Accuracy / liability across languages.** Machine translation can mis-render a question. Advise whether
   human review should be required before a translated survey is fielded, or whether a disclaimer suffices.
2. **Consumer/advertising-research norms by market.** Surveys fielded in a market are subject to that
   market's rules; confirm the neutral-translation guarantee is adequate or whether specific jurisdictions
   need more.
3. **Disclosure parity.** If a survey carries a required disclosure/eligibility/consent line, confirm it is
   provably carried into every translated variant.

---

---

## C. Mobile over-the-air (OTA) live updates — app-store policy

**What it does.** The app is a React web bundle inside a thin Capacitor shell. New this session: pushing to
`main` can auto-publish the updated **web bundle** to already-installed iOS/Android apps over the air (via the
`@capgo/capacitor-updater` plugin), so web-layer changes reach users **without an App Store / Play review**.
The native shell is unchanged; a bad bundle auto-rolls back.

**Design already in place (for your review):** OTA ships **only the interpreted web/JS layer** — screens,
logic, styles, copy, bug fixes. Anything native (a new plugin, a new OS permission, or a change to the app's
core purpose) still goes through a normal store release. The intent is bug fixes / UI / A-B variants, not
shipping a different app. **Now enforced by a server-side kill-switch:** OTA is OFF by default and installed
apps check the backend flag `MOBILE_OTA_ENABLED` before applying any bundle (the plugin's blind auto-apply is
disabled), so the operator can **halt a rollout instantly** if a bundle is out-of-scope or bad; a bad bundle
also auto-rolls back on device.

**Review questions for counsel:**
1. **Apple 3.3.2 / Google policy.** Both permit updating the interpreted (JS) layer provided it does not
   change the app's core purpose or circumvent review. Confirm our usage stays inside that line, and advise on
   any guardrails (e.g., a written policy limiting OTA to in-scope changes) before we enable it.
2. **Consumer-facing change control.** OTA can change what users see without a store gate; confirm this
   doesn't affect any disclosures, terms, or age-gating that a store listing or review would normally cover.
3. **Rollback / accountability.** Auto-rollback + version records exist; confirm that's adequate for any
   audit/accountability expectations.

Full detail: `MOBILE-OTA-LIVE-UPDATES.md` (also placed in this folder). The zero-downtime deployment change
made this session is infrastructure only (no user-facing or legal effect).

---

*Related design docs (full detail): `BUDDY-CHAT-SCHEDULING-AND-MATCHING.md`, `SURVEY-AUTO-TRANSLATION.md`,
`MOBILE-OTA-LIVE-UPDATES.md`. This session did not change the compliance spine — see `FOR-YOUR-ATTORNEY.md`
for the authoritative model.*
