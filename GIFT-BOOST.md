# Gift / Boost — platform-funded, user-triggered (no money transmission)

*The compliant alternative to peer-to-peer transfers. A user can send someone a small, capped, non-cashable
boost — but the value is funded by the PLATFORM, not moved out of the sender's wallet. Value flows platform →
recipient only, so there is no user-to-user money movement. Not legal advice.*

## Why it's not money transmission

Money transmission is moving value between users. Here nothing moves from the sender's balance to the
recipient's: the sender merely *triggers* a **platform-funded** grant to the recipient (optionally spending
their own non-cashable points as the trigger — a cost to them, never a credit to the recipient). This is the
group-goals structure (platform funds the reward) applied to gifting. The bonus stays closed-loop and
non-cashable. Contrast the gated `p2p_transfers` (real wallet-to-wallet value movement), which stays OFF.

## How it works

- The user picks a recipient (referral code / email / id) and an amount up to `GIFT_BOOST_MAX_USD`.
- The platform grants the recipient that non-cashable Site Cash bonus. The sender optionally spends
  `GIFT_BOOST_POINT_COST` of their own points as the trigger. A per-sender daily cap (`GIFT_BOOST_DAILY_CAP`)
  limits abuse.
- Nothing leaves the sender's balance for the recipient — the value the recipient receives is the platform's.

## Where it lives in code

- Flag: `gift_boost` (ON). Settings: `GIFT_BOOST_MAX_USD` (5), `GIFT_BOOST_DAILY_CAP` (3), `GIFT_BOOST_POINT_COST` (0).
- Model: `backend/sdk/gift-boost.ts` — config, `resolveRecipient`, `sentTodayCount`, `giftBoostDisclosures`.
  The recipient grant + optional sender point-cost move via `adjustUserBalance`.
- Entity: `GiftBoost` (owner-scoped by sender). Functions: `giftBoostSend`, `giftBoostStatus`. Page: `/GiftBoost`.
