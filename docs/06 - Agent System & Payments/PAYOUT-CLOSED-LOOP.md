# Closed-Loop Payouts — Users Earn Credit, Only Partners Get Cash

**Decision implemented:** the platform is now **closed-loop for users** — regular users' earnings stay as on-site credit (redeemable for perks) and are **never** paid out as cash. Only business **partners** (developers, survey creators, advertisers, affiliates) receive real cash — their revenue share — via PayPal/CashApp/Venmo. PayPal/Stripe **inbound** (businesses & customers paying you, BitLabs earnings) is unaffected.

_Implemented July 23, 2026. This corrects the original Base44 design, which paid regular users cash for referrals/contests — a model that isn't closed-loop and carries 1099 / money-transmitter obligations (flagged in COMPLIANCE-AND-ASSUMPTIONS)._

## What changed
- **New:** `backend/sdk/payout-policy.json` (the control list) + `backend/sdk/payout-policy.ts` (`isPartnerPayout()`).
- **Modified rails:** `paypalPayout`, `cashappPayout`, `venmoPayout`. Each now checks `isPartnerPayout({ role, payout_type })` **before doing anything**. If it's **not** a partner payout, the rail returns `{ blocked: true, closed_loop: true, cash_sent: false }` and no money moves — the user's earnings simply remain as their on-site balance. Partner payouts pass this check and then still go through the human-approval gate.

Enforcement is at the **money rails** (the exit doors), so no function anywhere can cash out a regular user — regardless of which of the 526 functions initiates it. This is the same chokepoint strategy used for the oversight gate.

## Who gets cash (tune in payout-policy.json)
- **Cash allowed** (partners): roles `developer`, `survey_creator`, `ppc_advertiser`, `affiliate`, `business`, `streamer`, `partner`, `admin`; or payout types `revenue_share`, `developer_payout`, `creator_payout`, `affiliate_commission`, `ppc_payout`, `sponsorship`, `business_payout`, `partner_payout`.
- **Blocked → stays as credit** (users): everything else — `referral_commission`, `contest_win`, `mlm_commission`, `reward`, generic user withdrawals.

Change the two lists in `payout-policy.json` to widen or narrow who counts as a partner. No code change.

## How users hold and spend value (already in the app)
Users' earnings accumulate as their on-site balance (`commission_balance` / `virtual_currency`) via the normal earning functions, and they spend it through `redeemRewardPerk` (the `RewardPerk` / `RedemptionRecord` system) and the on-site store. That closed-loop layer already existed — this change simply removes the cash exit for users so the loop is actually closed.

## Honest follow-ups (recommended, not yet done)
The rails are now a hard backstop — **no user cash can leave.** To make the experience clean and avoid confusion, you should also:
1. **Hide/disable the user-facing "Withdraw / Cash Out" UI** so users don't request a cash-out that will just be blocked. Relevant pages to review: `ManagePayouts`, `MyPayouts`, `PayoutSettings`, `PayoutStatus`, `SmartPayoutDashboard`, and any "withdraw" button in the wallet/profile.
2. **Review the withdrawal request functions** (`requestPayout`, `requestManualPayout`, `processWithdrawalRequest`, `autoWithdrawalApproval`, `autoWithdrawalRequestLifecycle`): if any **debit** a user's balance *before* calling a rail, ensure they don't debit for now-blocked user cash-outs (otherwise a user could lose credit with no cash sent). Simplest: disable user-initiated withdrawals at the request step. These are already human-gated, so nothing auto-executes meanwhile.
3. Optionally reword contest/referral copy from "cash prize" to "on-site credit / store reward."

I did **not** auto-rewrite the debit logic in every withdrawal function, because that varies per function and doing it blindly risks balance bugs — it's a small, deliberate pass best done with the list above. The money door is closed now; these steps make the UX match.

## Note on inbound (unchanged, correct)
`createPayPalSurveyOrder` / `capturePayPalSurveyOrder` and `createStripePaymentIntent` / `confirmStripePayment` take money **in** from businesses/customers. Those are your revenue and are untouched — exactly the PayPal/Stripe usage you described as correct.
