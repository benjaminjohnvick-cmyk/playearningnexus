# Contact-Invite Referral Flow — how it's built (and why this way)

The feature: a user opts in, grants contact access **on their phone**, picks contacts, customizes the message
with their friends' names, reviews, and sends. Built the compliant way.

## The one rule that makes it legal: the USER'S PHONE sends, not the server

Auto-blasting SMS from the server to a user's harvested contacts — people who never opted in — is a **TCPA /
CAN-SPAM violation** with **$500–$1,500 in statutory damages per text**, and it gets apps sued and removed
from the app stores. Several well-known apps were hit with class actions for exactly the "invite all your
contacts" pattern.

So this flow is architected so **the platform never sends a message and never receives the contact list.**
The messages go out from the **user's own phone, through their native SMS/share sheet**, as personal texts to
people they actually know. That's a person texting their friends — not a platform spamming strangers. The
server only provides the referral link + an optional template, records consent, and keeps a data-minimized
daily count for anti-spam.

## The user flow (on-device)

1. **Opt in + consent.** The user turns the feature on, grants OS contact permission, and affirms *"I know
   these contacts and am sending from my own phone."* (Consent is recorded server-side; contacts are not.)
2. **Pick contacts** — on the device, from their own address book.
3. **Customize** — the template (`{{name}}`, `{{link}}`) is pre-filled with each friend's name and the user's
   referral link; the user edits it freely.
4. **Review + send** — the app opens the **native SMS composer / share sheet** pre-filled; the user taps send
   themselves. (No silent auto-send. On iOS/Android, batch texts still surface for the user to send.)
5. **Report count** — the app tells the server *how many* were sent (a number only) so the daily cap and
   attribution work. No contacts, numbers, names, or message bodies are ever sent to the server.

> The "one push" experience you wanted is preserved — scan → customize with names → review → send in one
> smooth flow — the only change is the *send* goes through the user's own phone, which is the whole reason
> it's safe.

## What the server stores (data-minimized)

`ReferralInviteBatch` records ONLY: `user_id`, `day`, `count`, `channel`, `template_customized`, and a
`consent_ref`. It explicitly does **not** store contacts, phone numbers, names, or message text — those never
leave the device. Plus a `ConsentRecord` (kind `referral_contact_invite`) as the audit trail.

## Guardrails

- **Server never sends; never stores contacts.** (The two things that create legal exposure.)
- **Consent is mandatory** before any invite is recorded, and the user affirms the relationship.
- **Daily cap** (`REFERRAL_INVITE_DAILY_CAP`, default 50) rate-limits per user to prevent spam and protect
  deliverability.
- **Only qualified referrals reward the user** — a friend who actually joins and completes a fraud-screened
  first survey (existing `Referral.signup_bonus_paid`). Sending invites alone earns nothing, so there's no
  incentive to blast.
- Each qualified referral is worth **$5 internally** (`REFERRAL_INTERNAL_VALUE_USD`) — an internal accounting
  figure stamped on the `Referral` row, **never shown to any user**.

## Backend built

- `backend/sdk/referral-invite.ts` — link builder, template, daily cap, `recordInviteBatch` (data-minimized).
- `backend/functions/referralInviteConfig` — returns the user's link, template, and remaining allowance.
- `backend/functions/referralInviteRecord` — records consent + a count from the device (never contacts).
- `ReferralInviteBatch` entity (data-minimized). `REFERRAL_INTERNAL_VALUE_USD` stamped in `referral-rewards.ts`.

## Mobile side (WIRED)

- **Plugin:** `@capacitor-community/contacts` is in `package.json`. `npx cap sync` picks it up. The page
  (`src/pages/ReferralInvite.jsx`) dynamically imports it and falls back to manual entry if it's unavailable
  (e.g., on web).
- **Permission strings:** injected by `scripts/inject-native-permissions.mjs` — iOS
  `NSContactsUsageDescription` into `ios/App/App/Info.plist`, Android `READ_CONTACTS` into the manifest. It's
  idempotent and runs automatically after the native shells are (re)generated: it's wired into
  `scripts/regenerate-native.sh` and both `codemagic.yaml` build workflows (after `cap sync`, before build).
  This is required because `android/` and `ios/` are git-ignored and recreated on each build.
- **Flow:** the page reads contacts on-device, builds messages from the template, opens the native SMS
  composer per contact (the user taps send), then calls `referralInviteRecord` with the **count only**.
- The address book is never uploaded and messages are never sent server-side.

To build native shells locally: `bash scripts/regenerate-native.sh` (adds platforms, syncs, injects the
permission strings), then open Android Studio / Xcode.

*Not legal advice. The device-sends / server-never-stores design is chosen specifically to stay clear of
TCPA/CAN-SPAM and contact-privacy claims. Counsel should review the consent copy and the flow before launch.*
