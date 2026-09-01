# Buddy Chat — Scheduling, Auto Pop-up & KYC Matching

New Buddy Chat capabilities. Everything is gated OFF by default and applies to **all tiers (premium and
non-premium)** unless noted. Nothing here changes the money model: rewards stay closed-loop Site Cash,
chat stays answer-walled and moderated, Leave/Report always work.

## 1. Available to premium users too
Buddy Chat is now explicitly available to premium members (setting `BUDDY_PREMIUM_AVAILABLE`, default ON).
Premium remains *optional* for them (they aren't forced into pairing the way non-premium is), but they can
use every Buddy Chat feature. Turn the setting OFF only to hide Buddy Chat from premium accounts.

## 2. Book your next session (next day)
When a session ends, every user picks a **local time to meet again the next day**. We store the choice as an
absolute UTC instant plus the user's IANA timezone.
- **Endpoint:** `buddyScheduleNext` — `{ local_time: "HH:MM", timezone, match_preference?, with_new_user? }`.
- **Hub buttons** (`buddyChatHub`): **"Schedule next chat"** and **"Schedule with a new buddy."**
- A user can't start a *new* session until their booked moment arrives (`buddyMatch` returns
  `status: "scheduled"` until then). Settings: `BUDDY_NEXT_SESSION_BOOKING_ENABLED` (master, sensitive),
  `BUDDY_BOOKING_MAX_AHEAD_HOURS` (default 36), `BUDDY_SESSION_START_GRACE_MIN` (default 120).

## 3. Auto pop-up at the chosen time
A scheduled job (`buddyScheduledPopups`, every 5 min) fires a `buddy_popup` notification at each user's
booked moment — in **their own timezone** — carrying `action: "open_buddy_chat"` so the client auto-opens
Buddy Chat. `buddyStatus` also returns `next_session.should_auto_open` so a polling client pops it open at
the moment. Missed slots (past the grace window) are expired, not popped late. Setting `BUDDY_POPUP_LEAD_MIN`
fires the alert a few minutes early if desired.

## 4. Cross-timezone coordination
Each user picks a *local* time; we compare the underlying **UTC instants** and bucket them
(`BUDDY_SESSION_MATCH_WINDOW_MIN`, default 20 min). Buddies who chose the **same real-world moment** — e.g.
6 pm New York, 3 pm Los Angeles, 11 pm London — land in the same bucket and are matched to each other, each
seeing their own local time. `buddyMatch` prefers a same-bucket partner.

## 5. Schedule with a new buddy — KYC matching
Booking with `with_new_user: true` (or `match_preference: "new"`) matches the user with a **new** partner
(never a past buddy) chosen for **shared interests**, scored from the first (KYC) survey:
`kycAffinity()` weighs shared interest categories (×3), goals (×2), and game genres (×2), plus small nudges
for matching device/shopping style. `"keep"` instead tries to reunite the same buddy.

## 6. Browse profiles & pick your own match
The KYC survey now also builds a **privacy-safe, browsable profile** so members can pick their own match
instead of relying only on the auto-matcher.
- **Privacy:** a card shows **first name + interests only** (categories, goals, game genres, style, device).
  It never exposes email, full name, free-text answers, budget/financial answers, age, or any custom survey
  field. Browsing is **opt-in** — a member appears only after turning their profile public
  (`buddyProfileVisibility`).
- **Endpoints:** `buddyProfileBrowse` (list public profiles ranked by shared-interest affinity, with a
  free-text/country filter) and `buddyPickMatch` (`{ target_user_id, when: "now" | "schedule", local_time?,
  timezone? }`). Picking is an **invite**, never a forced pairing: the target gets a `buddy_invite`
  notification and pairs only when they come to Buddy Chat. `buddyMatch` honors an invite (someone picked me)
  and a scheduled pick (I picked them) ahead of the auto-matcher.
- **Hub button:** **"Browse & pick a buddy."** Setting `BUDDY_PROFILE_BROWSE_ENABLED` (sensitive).

## Data & jobs
- New entity **`BuddyNextSession`** — one active booking per user (`next_session_at` UTC, `timezone`,
  `local_time`, `utc_bucket`, `match_preference`, `preferred_user_id?`, `status`).
- `BuddyPair` waiting slots now carry `utc_bucket`, `match_preference`, and `invited_user_id`.
- New scheduled job **`buddy-next-session-popups`** (`*/5 * * * *`) → `buddyScheduledPopups`.
- User flag `buddy_profile_public` (opt-in to the directory).

## Settings summary (all default-safe)
`BUDDY_PREMIUM_AVAILABLE` (on) · `BUDDY_NEXT_SESSION_BOOKING_ENABLED` (off, sensitive) ·
`BUDDY_SESSION_MATCH_WINDOW_MIN` (20) · `BUDDY_POPUP_LEAD_MIN` (0) · `BUDDY_BOOKING_MAX_AHEAD_HOURS` (36) ·
`BUDDY_SESSION_START_GRACE_MIN` (120) · `BUDDY_PROFILE_BROWSE_ENABLED` (off, sensitive).
