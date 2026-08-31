# Counsel Brief — Live Hosting, Monetization, Streaming & AI-Host Features

**Purpose:** This brief summarizes the compliance-relevant features added in the latest build so counsel can
review them before any are enabled. **Every feature described here ships gated OFF by default** and appears in
the operator Setup Wizard; none is live until an operator turns it on. Several items are flagged as needing legal
review before they are enabled at all. Nothing here changes the platform's core posture: **Site Cash is
non-cashable closed-loop store credit; users only ever receive Site Cash; businesses/sellers are paid real
money; identity, money, and compliance decisions remain server-authoritative.**

## 1. On-device data & compute (privacy)

The app can keep a copy of **only the user's own data and the public product catalog** on their device for
offline/instant reads, and can run non-authoritative per-user work (search, ranking) on the device. It never
places another user's data on a device, and money/identity reads (balances, payouts, tax, KYC) always come live
from the server. The authoritative database stays server-side. *Review angle:* confirms data-minimization; no
third-party PII on user devices.

## 2. Hosting access — "earn to unlock" ($4/day)

Live hosting unlocks for a user once that day's **earnings** reach a threshold (default $4, any earning source,
including buddy chat). The $1/day membership fee is drawn from those earnings (never billed, never a debt).
**This is an unlock *condition*, not an income promise** — the code never asserts a user *will* earn a given
amount in a given time. *Review angle:* please confirm the unlock framing and that any "typical time to earn"
copy is presented as an estimate, not a guarantee.

## 3. User-hosted content — streaming & screen mirroring (gated, pending moderation)

Users can host games, live streams, or **screen mirroring** (share what's on their screen). This ships **OFF**
(`HOSTING_ALLOW_NONGAME`) pending a moderation program, because user-generated live content raises:

- **Copyright/DMCA** (re-streaming third-party video/games), **privacy** (a screen can expose personal data),
  **age/safety** (18+), and **illegal-content** risk.

Built-in guardrails: the host must accept a content policy at start; the platform has existing moderation hooks
(`autoChatModeration`) to extend. *Open question for counsel:* required moderation, notice-and-takedown (DMCA
agent registration), age-gating, and acceptable-use terms before public streaming is enabled.

## 4. Recording, clips & replay (gated; consent + moderation)

Hosts can record a session or save a clip. Media is stored in object storage; the platform holds only metadata,
and a recording is **held pending moderation** before anyone can replay it. **Participant consent** is required.
*Review angle:* consent language and recording-retention/takedown policy, especially for screen recordings.

## 5. Remote control / co-op (gated; tightly scoped)

A host can hand another player **in-game input control only**. The scope is locked in code to `game_input`;
anything touching the OS, navigation, account, or money is refused, and control is revocable. Sensitive actions
never run in the session path. *Review angle:* low risk by design; noted for completeness.

## 6. Monetization — the invariant

Every money-making mode enforces one rule in code: **users only ever receive Site Cash; businesses/sellers are
paid real money.** Modes (each independently gated):

- **Skill tournaments — Site Cash (default):** Site-Cash entry, Site-Cash prizes. Stays in the closed loop.
- **Skill tournaments — REAL MONEY (`HOSTING_REAL_MONEY_TOURNAMENTS`): flagged `needs_counsel`, OFF.** Paid-entry
  cash contests are **regulated state-by-state** in the US (several states restrict or prohibit paid skill
  contests), require **18+** and eligibility gating, and **conflict with "users only get Site Cash."** **This is
  the single most significant item for legal review** — do not enable without a state-by-state analysis and a
  decision on the sweepstakes/free-entry alternative.
- **Paid access to virtual content:** viewers either **donate Site Cash** or **complete an advertiser-funded
  survey** — never a real-money charge to a user.
- **Retail / QVC-style live shopping:** orders placed in **Site Cash**, revenue AI-tracked and split (default
  50/50). The **business** seller is paid **real money**; a user seller is credited Site Cash; the buyer only
  ever spends Site Cash. Real-money seller payouts require **KYC/tax onboarding** first.

## 7. Third-party sellers

Third-party sellers can sign up (reusing existing onboarding) and host retail sessions. Business sellers are paid
real money and therefore require **KYC and tax (1099) onboarding** before any payout. *Review angle:* seller
agreement, marketplace liability, and tax-reporting obligations.

## 8. AI-hosted advertiser fallback

When an advertiser's product underperforms on social, the platform can auto-launch a live-shopping session hosted
by an **AI presenter** (rendered via a third-party video engine) configured to the advertiser's demographic.
Built-in disclosure, enforced in the render brief: the host is **disclosed as AI-generated and as an ad (#ad)**,
**never impersonates a real person**, presents product **value only** and **never promises results**, and
"demographic match" is creative tone only (not targeting protected categories). *Review angle:* FTC endorsement/
AI-disclosure guidance and advertising-claims substantiation.

## 9. Social simulcast of livestreams

A hosted stream can be announced/simulcast across social media **only through accounts the user explicitly
connected and consented to, per post**, with `#ad` disclosure — never silently, never to non-owned accounts.
Multi-platform video simulcast routes through a media relay; **platform stream keys are treated as secrets** and
are never handled in plaintext by application code (only secret-manager references). *Review angle:* FTC
disclosure, platform ToS compliance for each social network.

## 10. Posture summary

- Everything above is **OFF by default** and surfaced in the operator Setup Wizard (enforced by an automated
  build check so no gated feature can ship hidden).
- **Users only ever receive Site Cash; businesses receive real money; the source of truth stays server-side.**
- Items explicitly flagged for legal sign-off before enabling: **real-money tournaments (§6)**, **public
  streaming/screen-mirroring moderation & DMCA (§3)**, **recording consent/retention (§4)**, **AI-host
  disclosure (§8)**, **seller KYC/tax (§7)**.

*This document is an engineering summary for legal review, not legal advice. It describes intended behavior and
the guardrails coded in; counsel should confirm the requirements before any flagged feature is enabled.*
