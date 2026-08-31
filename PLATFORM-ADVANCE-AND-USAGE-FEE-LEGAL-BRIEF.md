# Counsel brief — free non-recourse purchasing-power advance + daily usage fee (and the ideas EXCLUDED)

**For the attorney.** Two revenue/feature elements are BUILT and shipped **OFF by default pending your review**.
This brief states how each works, the questions we need ruled on, and documents the ideas we deliberately
**did not build** and why. Nothing charges a user or moves money until you approve and we enable the flags.
**PayPal Buy-Now-Pay-Later was removed** — the platform finances everything itself, internally. Design spine:
**free and non-recourse (never a debt), from a user's own earned rewards only, disclosed honestly, and nothing
ever leaves the closed loop.**

---

## 1) Free, non-recourse purchasing-power advance ("money upfront, work it off with surveys") — BUILT, gated OFF

**What it does.** The platform fronts an eligible member its **own store credit** (Site Cash) to spend now, and
recoups it **only** from that member's **future advertiser-funded survey rewards** — a configurable share each
period (default 50%), so earning is never fully absorbed. It is designed to be as far from a consumer loan as we
can make it:
- **FREE** — no fee, no interest, no late fees. (Charging *for* the advance is what makes an advance look like
  credit with a finance charge; there is no charge here.)
- **NON-RECOURSE** — the member is never obligated to repay in cash. Recoupment comes only out of rewards they
  earn; at term end any un-recouped balance is **FORGIVEN** (`ADVANCE_YEAR_END_FORGIVE`). No debt, no collection,
  nothing reported.
- **EARNED / GATED** — premium members only (`ADVANCE_PREMIUM_ONLY`), and only after a **track record**: a
  minimum earnings history (`ADVANCE_MIN_EARN_HISTORY_USD`) and account age (`ADVANCE_MIN_ACCOUNT_DAYS`) — "shown
  they'll pay it back." The first advance is small (`ADVANCE_FIRST_CAP_USD`) and grows toward the per-member cap
  (`ADVANCE_MAX_USD`, default $2,000) as prior advances are recouped — a trust graduation.
- **INTERNAL** — it is the platform's own store credit; it never touches PayPal, never converts to cash, never
  leaves the platform. So no money transmission and **no closed-loop break** (see the note below).

Code: `sdk/advance.ts` (+tests), `advanceOffer`/`advanceStatus` (read-only), `advanceGrant`/`advanceRecoupSweep`
(gated; preview-only while disabled). Ledger types `advance_grant` / `advance_recoup`. Table `Advance`. Flag
`ADVANCE_ENABLED=0`.

**Business note (not a legal question).** Because the platform finances the advance, the platform **carries the
recoupment risk** — it fronts value it may not fully recoup. That risk is bounded by the eligibility gates,
per-member caps, and advertiser-pool funding. (This is the trade for "I finance everything": PayPal's version
had zero risk to us but we couldn't route repayment through the platform; this version can, so the risk is ours.)

**Questions for counsel.**
- Does a **free, non-recourse** advance of the platform's own store credit — no interest, no fees, forgiven if
  not earned back, recouped only from the member's future advertiser-funded rewards — stay **outside consumer-
  credit / TILA** (i.e., not "credit," because there is no obligation to repay and no finance charge)? This is
  the central question. We understand non-recourse "advance against future earnings" products (earned-wage-
  access, income-share) still draw scrutiny; is this structure and its disclosures sufficient?
- Is the **premium + earnings-history + graduation** gating a helpful responsible-lending posture, and is there
  any point at which the graduation/size makes it look like an underwriting/credit decision we must license?
- Confirm the recoupment mechanic (a share of *future* rewards, member keeps the rest, never clawing existing
  balance, never pushing negative) raises no wage-assignment / garnishment-style issue.

## 2) Uniform daily usage fee ($1/day, from earnings) — BUILT, gated OFF

**What it does.** A **uniform** daily fee (default **$1.00/day**, `USAGE_FEE_ENABLED=0`) charged to **all users**
the same way, deducted **only from earned rewards** (never billed, never a debt — if they haven't earned it, it
doesn't accrue; a balance can never go negative), capped (default **$365** over a rolling year), and **offset by
one extra advertiser-funded survey** so the member still nets their target (~$4/day). At ~$365/year it recoups
more than 10% of a $2,000 annual spend **without any per-purchase fee** — a flat membership/usage fee, not a
transaction fee, surcharge, or deferred charge. Code: `sdk/usage-fee.ts`, `usageFeeApply` (gated), `usageFeeStatus`.

**Questions for counsel.**
- Is a per-day usage fee **taken only from earned, non-cashable rewards** (never billed, never a debt) acceptable
  as a platform fee, and are the disclosure + honest-**net**-earnings mechanics sufficient to avoid a deceptive-
  practices (FTC/UDAAP) issue? (Earnings must be stated net of the fee — never a gross figure the fee reduces.)
- Any recurring-fee / negative-option disclosure requirements (even though it's deducted from rewards, not a card)?
- Charging all users to use the site changes our "free to use" positioning — confirm the disclosure that makes
  that clear and non-deceptive.

## 3) Ideas we deliberately EXCLUDED (and why) — please confirm the boundary

Considered and **not built**, because each makes the platform an unlicensed lender/servicer/transmitter or crosses
a bright line:
1. **PayPal BNPL at all** — removed at the owner's direction; the platform finances internally instead.
2. **Converting Site Cash / routing earnings to a PayPal (or any external) loan** — money transmission + breaks
   the closed loop. **Excluded.**
3. **A "$2,000 boost" or platform funds covering/repaying a member's loan** — makes the platform guarantor;
   unlicensed lending + fraud magnet. **Excluded.**
4. **A fee charged only when BNPL is used, or rebated to everyone except BNPL users** — disguised surcharge.
   **Excluded.**
5. **Adding friends/family so their activity pays a member's loan** — recruitment-for-financial-gain tied to debt
   (pyramid/endless-chain), pooling others' earnings to service a debt (transmission + guaranty), pressure on
   personal relationships. **Excluded.**
6. **A deferred 10% consumer fee collected at year-end** — deferring payment of a fee IS extending credit; it
   re-creates the finance-charge problem. **Excluded** in favor of the flat $1/day membership.
7. **Making Site Cash "cashable but only toward the loan/fee"** — un-seals the closed loop and makes us the
   servicer. **Excluded.**

**The bright line:** the platform never funds, covers, guarantees, pools-to-repay, or routes earnings to an
*external* consumer loan; nothing converts non-cashable Site Cash to cash. The only advance is the platform's own
free, non-recourse **internal** store credit. (Your **10%** economics live in normal marketplace/affiliate
revenue and the flat membership — never a per-purchase consumer credit fee.)

## Enabling after your sign-off — the counsel gate

Everything ships OFF. When you approve, the owner enables features through the Setup Wizard's **Counsel-gated
features** panel, backed by `counselFeatureGate`: it lists every pending-counsel flag with its state and enables
them **only with an explicit `COUNSEL_APPROVED` acknowledgment** (per-feature toggles; the "enable all" action
requires confirming full sign-off). This is intentionally **not** a blind one-click — each flag
(`ADVANCE_ENABLED`, `USAGE_FEE_ENABLED`, plus the endorser/referral flags from the other brief) should be turned
on only after you approve that specific feature.

## Guardrails already coded

- Advance: free, non-recourse (shortfall forgiven), premium + track-record gated, per-member cap, graduated,
  internal store credit only, preview-only while disabled.
- Usage fee: from earned rewards only (never a debt), capped, disclosed, survey-offset, idempotent per user/day,
  preview-only while disabled.
- Nothing external, nothing cashable, no closed-loop break; everything OFF by default until you enable it.
