# Earn Hook & Scheduled Reminder — Compliant Design

*The legal, store-policy-safe version of "a home-screen hook that brings users back to earn, plus an
end-of-session offer to remind them at a time they pick." Mobile (iOS + Android) re-engagement, built so every
piece is user-opted-in, user-controlled, and inside platform + ad-network rules. Not legal advice — flags the
questions for counsel. Prepared 2026-09-04.*

---

## 0. The five rules everything here obeys

1. **User-initiated, never auto-fired.** No widget or notification launches the app or plays an ad by itself.
   The user always taps. (OS + ad-policy hard limit — see §1.)
2. **Rewarded ads are user-initiated.** The "watch to earn" ad only plays after the user chooses it in-app —
   required by AdMob and Apple.
3. **Closed-loop, non-cashable Site Cash.** Users earn Site Points/Site Cash, never withdrawable money.
4. **No guaranteed earnings.** Copy says "earn *some* extra Site Cash," never a promised amount or "$X". (FTC.)
5. **No ads in widgets or notifications.** Those surfaces show *our own* content only and deep-link into the
   app, where ads are allowed. (Apple + Google policy.)

Everything below is one opt-in re-engagement loop that respects all five.

---

## 1. The hook — a one-tap-to-earn widget (start here)

A home-screen / lock-screen **widget** on both platforms:

- **iOS:** a WidgetKit widget (home screen + lock screen, iOS 16+). **Android:** an app widget (Jetpack Glance).
- It shows **our own content** — the user's Site-Cash balance, streak, and "Ready to earn today? Tap to start."
- It **cannot auto-launch or auto-play** (OS rule) and **cannot contain ads** (policy). It is a *hook*: a
  glanceable prompt that, on a **single tap**, deep-links straight into the in-app earn flow.
- **The user option:** a checkbox **"Open straight to earn."** When on, tapping the widget jumps directly into
  the rewarded-ad / earn screen (skipping the app home) — the maximum automation the platforms allow: one tap,
  not zero. When off, the widget opens the app normally.
- In the earn screen the user chooses to watch a rewarded ad; on completion, **Site Points auto-deposit** to
  their balance via the existing ledger. Non-cashable, closed-loop.

---

## 2. The end-of-session offer — "earn extra today?" (your example, compliant)

At the **end of a session**, a single, dismissible card:

> **"Want to earn some extra Site Cash today?"**
> *Pick a time and we'll send you one reminder to come back and earn.*
> **[ Choose a time ]   [ No thanks ]**

Compliance shape:
- **Genuine choice, dismissible.** "No thanks" closes it with no penalty. Not shown every session — **frequency
  capped** (e.g. at most once/day, and backs off if repeatedly dismissed) so it never becomes nagging/dark-pattern.
- **Honest wording.** "*some* extra Site Cash" — never a dollar amount, never "guaranteed." Site Cash, not
  "money."
- **The user sets the time.** They pick when the reminder arrives (a designated/preselected time *they* choose)
  — this is what makes the later pop-up a *requested reminder*, not an unsolicited push.
- Choosing a time **opts them in** to that one reminder and (if they haven't already) triggers the OS
  notification-permission prompt.

---

## 3. The scheduled reminder — a local notification at the user's chosen time

At the preselected time, a **local notification** fires:

> **"Your extra Site Cash is waiting 🎉 — tap to earn."**

- It's a **local scheduled notification** the user *asked for* — the compliant form of "automatically pops up at
  a set time." It does **not** auto-open the app or play an ad; the user **taps** it, which deep-links into the
  earn flow (§1), where they choose to watch a rewarded ad and earn.
- **No ad content in the notification** (policy) — it's a content prompt only.
- **Respects the rules:** honors the OS notification permission (if denied, no reminder — and the app says so),
  respects quiet hours / Do Not Disturb, and is **capped** (default one reminder per day).
- **Easy off, everywhere:** a clear toggle in account settings and in the notification's own actions ("Turn off
  reminders"), plus the OS-level notification controls. One tap to stop.
- **Global posture:** treated as an opt-in the user set; for regions requiring explicit consent for such
  messaging we keep it opt-in (which it already is). No marketing content rides along — it's strictly the
  reminder the user requested.

---

## 3b. Continuous earn session (opt-in "keep earning")

For users who want to earn for a stretch, an **opt-in continuous session**: they start it, rewarded ads play in
sequence, and points accrue — but it is **not hands-off auto-play**, because that isn't allowed and would be ad
fraud. Two hard reasons: a rewarded ad must be **user-initiated**, and the advertiser is paying for each
impression on the assumption a **real person is watching** — if ads auto-chained forever with no interaction
(phone face-down), the advertiser pays for views nobody sees, which ad networks detect as **invalid traffic**
and shut the account over. So the compliant shape is:

- The user **opts in** (`earn_continuous_opt_in`) and **starts** the session; they can **stop anytime**.
- A **presence check** — a "keep earning?" tap — is required every `EARN_CONTINUOUS_RECONFIRM_EVERY` ads
  (default 5). This keeps each ad user-initiated and proves a real viewer.
- The session **auto-ends** after `EARN_CONTINUOUS_MAX_SESSION_MIN` (default 30 min) **or** when the daily /
  lifetime earning **cap** is hit (`ad_available` goes false) — whichever comes first.
- Same rewarded ads, same closed-loop points, same caps as §1 — this just lets the user chain several in a row
  with periodic re-confirmation instead of one at a time.

Settings: `EARN_CONTINUOUS_ENABLED`, `EARN_CONTINUOUS_RECONFIRM_EVERY`, `EARN_CONTINUOUS_MAX_SESSION_MIN`.
Backend: `earnHookConfig` returns the continuous config + opt-in; `earnHookSetPrefs` sets the opt-in; each ad
still credits through `earnAdReward` (caps enforced there). The auto-play loop + presence-check UI is native.

---

## 4. Guardrails (what this deliberately does NOT do)

- **No auto-launch / auto-play.** Nothing opens the app or starts an ad without a user tap (OS + ad policy).
- **No ads in widgets or notifications.** Those are content-only; ads live in-app.
- **No guaranteed-earnings language.** Never "$X", never "guaranteed."
- **No forced or nagging prompts.** The end-of-session offer is dismissible and frequency-capped; the reminder
  is user-scheduled and one-tap-off.
- **No real-money payout.** Earnings are closed-loop Site Cash, non-cashable.
- **No third-party/behavioral tracking** required for any of this — it runs on the user's own account activity.

---

## 5. The exact opt-in / copy (so counsel can review wording)

- End-of-session card: *"Want to earn some extra Site Cash today? Pick a time and we'll send you one reminder."*
  Buttons: **Choose a time** / **No thanks**.
- Time picker confirmation: *"Great — we'll remind you at 7:00 PM. You can change or turn this off anytime in
  Settings."*
- Reminder notification: *"Your extra Site Cash is waiting — tap to earn."*
- Settings row: **Daily earn reminder** — [ time ] — with an off switch and "one reminder per day."
- Widget option: **Open straight to earn** (on/off).

---

## 6. Where it wires (build split)

**Backend + web (this repo — buildable now, gated OFF):**
- User preferences: `earn_reminder_opt_in`, `earn_reminder_time`, `earn_hook_open_straight_to_earn`, all with
  opt-out; stored on the user, logged in the consent ledger (`recordConsent`).
- A **widget-feed endpoint** (returns balance, streak, "ad available" for the widget to display).
- A **rewarded-ad-view crediting endpoint** (credits closed-loop Site Points on a completed, user-initiated
  in-app rewarded ad; frequency/daily caps as cost governors; booked via the ledger).
- End-of-session offer eligibility + frequency-cap logic (server-decided so it can't over-show).

**Native mobile (separate app project — hand-off code):**
- iOS **WidgetKit** extension (Swift) + Android **Glance** app widget (Kotlin), rendering the feed and
  deep-linking to the earn screen.
- **Local notification scheduling** at the user's chosen time (iOS `UNUserNotificationCenter`, Android
  `AlarmManager`/`WorkManager` + notification channel), honoring permission + quiet hours.
- Deep-link target: the in-app rewarded-ad / earn screen.

*(The widget and local-notification pieces are native — they ship through the app stores, not Railway. This
repo builds everything that feeds and rewards them.)*

---

## 7. Settings (all gated; master counsel-gated + OFF)

`EARN_HOOK_ENABLED` (master, sensitive, default 0, counsel-gated), `EARN_REMINDER_ENABLED` (feature toggle),
`EARN_REMINDER_MAX_PER_DAY` (1), `EARN_HOOK_OFFER_MIN_SESSION_GAP` (frequency cap on the end-of-session card),
`EARN_REWARD_PER_AD_POINTS`, `EARN_REWARD_DAILY_CAP_USD` (sensitive cost governor),
`EARN_REWARD_LIFETIME_CAP_USD` (sensitive). Everything defaults OFF and surfaces in the Setup Wizard like the
other gated levers.

---

## 8. For counsel

1. **Rewarded-ad policy** — confirm the in-app rewarded flow is user-initiated and disclosed per AdMob/Apple.
2. **Notification consent** — the opt-in + user-set time model, and any regional messaging-consent rules.
3. **Earnings claims** — the "some extra Site Cash / no guaranteed amount" copy (FTC).
4. **Store policy** — widgets/notifications carry no ads; nothing auto-launches; confirm passes review.
5. **Closed-loop** — reward stays non-cashable Site Cash.

---

## 9. Build order (when greenlit)

1. **Backend prefs + widget-feed + rewarded-ad crediting + caps** — gated OFF, no user-facing risk.
2. **End-of-session offer + frequency cap** (web/app UI reading the server eligibility).
3. **Native widget + local-notification scheduling** (mobile project, store submission).

Each step is gated and reversible. Nothing prompts, notifies, or pays until you enable it and counsel clears the
master flag.

*Not legal clearance — an organized map so counsel can review before the master flag is turned on.*
