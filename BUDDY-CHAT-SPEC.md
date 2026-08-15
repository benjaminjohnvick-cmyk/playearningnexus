# Buddy Chat — Feature Spec & Safeguards

*How the "earn-together" buddy/group chat works, the safety and anti-collusion guardrails around it, and how
its reward stays inside the closed-loop rules. Current as of 2026-08-15. Admin-tunable via settings; not legal
advice.*

## What it is

Buddy Chat is an **engagement mechanic** — body-doubling, not work-sharing. Two users pair up to keep each
other going while they complete surveys, cheering each other on. It is deliberately **not** a way to compare
or exchange survey answers; that line is walled off (see Answer-wall). Code lives in `backend/sdk/buddy.ts`
(+ `group.ts`, `scam-guard.ts`), the `buddy*`/`group*` functions, and `src/components/surveys/BuddyPanel.jsx`.

### How a session runs

- **Pairing.** A user is matched 1:1 (`buddyMatch`). If no buddy is found within `BUDDY_MATCH_WAIT_SECONDS`
  (default 60s), they're auto-added to an online **group** instead of waiting — never left stuck.
- **Encouraged default, never a lockout.** Paired earning is the default for non-premium users
  (`BUDDY_DEFAULT_NONPREMIUM`), and non-premium can't simply switch it off when `BUDDY_MANDATORY_NONPREMIUM`
  is ON — **but** the safety valves always remain: Leave/Report re-matches into a new buddy, earning is never
  blocked while waiting for a match, and premium users can opt out to solo. It's a nudge, not a cage.
- **Commitment.** Using chat asks each person to commit to earning their daily take-home (their half of the
  goal — default $4.50 each of a $9 day, `BUDDY_COMMIT_*`). An accountability agreement, with Leave/Report
  always live.
- **Tied to active earning.** Chat and voice **auto-pause** after `BUDDY_CHAT_IDLE_SECONDS` (default 60s)
  without a completed survey, and resume on activity — so chat supports earning rather than replacing it.
- **Unlock.** Once cumulative survey earnings reach `BUDDY_UNLOCK_EARNINGS_USD` (default $9), the user gets a
  higher message limit and an **opt-in in-app connect request**. This does **not** enable real-world meetups.

## Safeguard 1 — Answer-wall (anti-collusion)

Every message must be encouragement, never survey content. Buddies sharing answers would be collusion and
would leak advertiser IP, so free text is filtered (`answerWall` in `buddy.ts`):

- **Canned cheers are always safe** — a fixed set ("Keep going! 🔥", "You've got this 💪", …); no free-text risk.
- **Free text is blocked** if it's empty, over **280 characters**, or matches answer-sharing patterns —
  references to "answer", "question N", "Q N", "option/choice A–E", "put/select/pick A–E", "the answer is", etc.
- The wall is coarse by design; **moderation + reporting back it up**. It applies identically to buddy chat
  and group chat (`groupSendMessage` uses the same wall).

## Safeguard 2 — Scam-guard (money-platform protection)

A money app attracts "get you off-platform, then ask for money" scams. `scam-guard.ts` (`scanMessage`, on when
`SCAM_GUARD_ENABLED`, default ON) blocks five categories in buddy/group chat, each with a kind explanation:

- **off_platform_contact** — moving to Instagram/WhatsApp/Telegram/etc.
- **payment_handle** — Cash App / Venmo / PayPal / Zelle / wire / gift card / crypto wallet.
- **money_solicitation** — "send me money", "invest", "guaranteed returns", "double your…".
- **contact_info** — raw phone/personal contact details.
- **external_link** — URLs / bare domains.

The consistent message: keep it in-app, never send money to someone you met here, report anything off.

## Safeguard 3 — Message limits + moderation

- **Daily rate limit** per user: `BUDDY_CHAT_BASE_DAILY_LIMIT` (default 40 msgs) before unlock, rising to
  `BUDDY_CHAT_EXTENDED_DAILY_LIMIT` (default 500) after unlock. Over the limit → a 429, "you've hit today's
  chat limit." Keeps stranger chat spam-resistant.
- **"Extended," not "unmoderated."** The higher limit still passes the answer-wall + scam-guard on every message.
- **Report / Leave** (`buddyReport`, `reportChat`) are always available and re-match the user.
- **Transcripts** are retained `CHAT_TRANSCRIPT_RETENTION_DAYS` (default 90) for safety/moderation review and
  are exportable (`chatTranscriptExport`). **Disclose this retention in the privacy policy.**

## Closed-loop reward handling

The buddy bonus never breaks the closed-loop rules:

- **What it is.** A bonus for completing a paired session = `BUDDY_BONUS_PCT` (default 10%) of the day's take,
  **hard-capped** at `BUDDY_BONUS_DAILY_CAP_USD` (default $1/user/day). `buddyBonusUsd()` computes it.
- **Non-cashable, closed-loop.** Paid as **Site Cash** — spendable on-platform, not withdrawable. It is not a
  cash payout and does not touch the partner cash rails.
- **Reserve-gated + claimed, not auto-paid.** The bonus is gated against the funding reserve at the call site
  and granted via `buddyBonusClaim`, so it can't be minted beyond what's funded.
- **Not earnings for claim purposes.** It's a platform-funded engagement reward (like a streak bonus), not a
  third-party survey payout, and carries no promise of amount.

## Settings reference

| Setting | Default | Purpose |
|---|---|---|
| `BUDDY_ENABLED` | on | Master switch for earn-together buddies |
| `BUDDY_DEFAULT_NONPREMIUM` | on | Paired earning is the non-premium default |
| `BUDDY_MANDATORY_NONPREMIUM` | on | Non-premium can't disable chat (safety valves still apply) |
| `BUDDY_MATCH_WAIT_SECONDS` | 60 | Wait for a 1:1 buddy before group fallback |
| `BUDDY_CHAT_IDLE_SECONDS` | 60 | Auto-pause chat after survey inactivity |
| `BUDDY_UNLOCK_EARNINGS_USD` | $9 | Cumulative earnings that unlock extended chat + connect |
| `BUDDY_CHAT_BASE_DAILY_LIMIT` | 40 | Messages/day before unlock |
| `BUDDY_CHAT_EXTENDED_DAILY_LIMIT` | 500 | Messages/day after unlock (still moderated) |
| `BUDDY_COMMIT_ENABLED` / `BUDDY_COMMIT_TARGET_USD` | on / $4.50 | Daily take-home accountability commitment |
| `BUDDY_BONUS_PCT` / `BUDDY_BONUS_DAILY_CAP_USD` | 10% / $1 | Closed-loop paired-session bonus + cap |
| `SCAM_GUARD_ENABLED` | on | Block off-platform contact/payment/money/links |
| `CHAT_TRANSCRIPT_RETENTION_DAYS` | 90 | Retention of chat for moderation (disclose in privacy policy) |

## Compliance posture (summary)

Encouragement-only chat (answer-walled) avoids collusion and advertiser-IP leakage; the scam-guard keeps a
money platform's users safe from off-platform payment scams; message limits + moderation + 90-day transcripts
support trust & safety review; and the reward is capped, reserve-gated, non-cashable Site Cash — an engagement
bonus, not a cash payout or an earnings promise. Two items to keep disclosed: the transcript retention (privacy
policy) and, because chat is stranger-facing, the 18+ gate that already applies platform-wide.
