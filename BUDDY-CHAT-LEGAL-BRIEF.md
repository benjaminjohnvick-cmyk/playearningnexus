# Buddy Chat — Legal & Compliance Brief (for counsel)

**Prepared for the owner and outside counsel · Confidential — attorney work-product request. Not legal advice.**

> **Status: NEEDS LEGAL REVIEW.** Buddy Chat's *next-session booking* sub-feature ships **OFF** and is
> **counsel-gated** (`BUDDY_NEXT_SESSION_BOOKING_ENABLED` — enabling it in the Setup Wizard requires
> `COUNSEL_APPROVED`). The **core Buddy Chat feature is currently live** (pairing + encouragement chat, with
> voice notes and "connect" behind an earned unlock); this brief asks counsel to review the live parts as well
> and advise what, if anything, should also be gated, disclosed, or changed before continued operation.

## 1. What Buddy Chat is

An **accountability-buddy** layer inside the surveys/earning flow. While a member completes surveys, they are
paired with another active member so neither "earns alone." The pair can see each other's daily progress and
send **encouragement** — canned cheers plus limited free-text — and, once they've earned enough, unlock
extended chat, optional **voice notes**, and an opt-in in-app **"connect."** Design constraints already in code:

- **No real-world meetups.** There is intentionally no feature to arrange in-person meetings; `buddyConnectRequest`
  is in-app only, "for user-safety reasons" per the code comment.
- **Survey answers are blocked** in chat (anti-collusion) — messages are filtered.
- **Escape valves always available:** leave/skip a buddy, go solo (premium) or re-match (non-premium), and report.
- **Moderation:** text is filtered; voice notes are **transcribed for moderation** before/at delivery.
- **18+ platform.** The product is gated to adults.
- **Tiers:** available to premium (optional, `BUDDY_PREMIUM_AVAILABLE`, default on) and non-premium
  (**mandatory pairing**, `BUDDY_MANDATORY_NONPREMIUM`, default on — they cannot opt out of *being paired*, though
  they can always leave a specific buddy and are re-matched, never trapped).
- **Next-session booking (gated, OFF):** at the end of a session every tier can pick a local time to meet again
  the next day — the same buddy ("keep") or someone new ("new") — and Buddy Chat auto-opens then, matching
  same-moment buddies across timezones. Until a booked time arrives, that user's next session is held.

Relevant docs: `BUDDY-CHAT-SPEC.md`, `BUDDY-CHAT-SCHEDULING-AND-MATCHING.md`, `BUDDYCHAT-SOCIAL-SHOP-AND-AGENTS-DESIGN.md`.

## 2. Questions for counsel (grouped)

### A. Pairing strangers / user safety
1. Any duty-of-care or platform-liability exposure from algorithmically pairing adult strangers to chat? Does our
   report/block/leave design and content filtering suffice, or do we need documented trust-&-safety procedures,
   a code of conduct, and a takedown/appeal process?
2. Is the "no real-world meetup" posture enough to keep us clear of dating-service / in-person-introduction
   regulation in any state? Should Terms explicitly prohibit arranging offline meetings?

### B. Voice notes — recording & consent
3. Voice notes are **recorded and transcribed for moderation**. Which jurisdictions' **two-party/all-party
   consent (wiretap/eavesdropping) laws** apply, and is our in-app notice + consent capture sufficient? Do both
   buddies need to consent to recording, and how do we evidence it?
4. Retention: how long may we keep audio clips and transcripts for moderation, and what is the deletion path?

### C. Minors
5. The platform is 18+. What age-assurance is required given a social/voice feature (beyond a self-attested DOB)?
   What is our exposure and obligation if a minor circumvents the gate and uses Buddy Chat, especially voice?

### D. Mandatory pairing for non-premium
6. Non-premium users are **paired by default and cannot opt out of being paired** (they can leave any specific
   buddy). Is compelled participation in a social/chat pairing a consent, unfair-practice, or dark-pattern
   concern (FTC / state UDAP)? Should there be a clear opt-out or a disclosure at signup?

### E. Content moderation & mandatory reporting
7. What are our obligations for illegal content surfaced in chat/voice — in particular **CSAM detection and
   NCMEC reporting**, threats, and harassment? Do we need a documented moderation + escalation policy and
   records-retention for reports?

### F. Data & privacy
8. Chat transcripts, voice clips, pairing history, and "connect" records are personal data. Confirm our
   **privacy-policy disclosures, lawful basis, retention schedule, and GDPR/CCPA deletion/right-to-access**
   handling for these specifically. Are voice/biometric-adjacent considerations (e.g., Illinois BIPA) triggered
   by voice capture even though we do not do voiceprint identification?

### G. Next-session booking / scheduling (the gated sub-feature)
9. The booking feature schedules a member to be online at a chosen time and matches same-moment buddies across
   timezones. Any concern with **holding a user's next session** until their booked time (unfair-practice /
   consumer-expectation), and with the **notifications/alarms** that reopen the app (push/notification consent)?
10. Does matching two members at a designated time (even in-app only) change any of the A/B analysis above?

### H. In-app "connect"
11. "Connect" lets mutually-opted-in buddies link in-app. Confirm the consent flow, what identity/contact data is
    exchanged, and the disclosures needed.

## 3. Recommendation pending review

- Keep **`BUDDY_NEXT_SESSION_BOOKING_ENABLED` OFF and counsel-gated** (already implemented — it now sits in the
  Setup Wizard's "OFF until your lawyer signs off" section and requires `COUNSEL_APPROVED` to enable).
- Have counsel review the **currently-live** core Buddy Chat (pairing, encouragement chat, voice notes, connect,
  mandatory non-premium pairing) and advise whether any of those should also be gated, re-consented, disclosed
  differently, or modified — and whether a documented **Buddy Chat Trust & Safety / Moderation policy** and
  updated **Terms/Privacy** language are needed before continued operation.
- Implement counsel's required disclosures/consents and retention rules; then enable booking via the Setup Wizard.
