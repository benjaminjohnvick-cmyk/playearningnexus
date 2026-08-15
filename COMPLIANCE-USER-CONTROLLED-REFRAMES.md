# User-Controlled Compliance Reframes — applying the "set-aside" pattern to everything else

*Takes the move that made the earnings set-aside and Tier 1 Self-Paced compliant — put the control in the
user's hands as a voluntary, no-obligation option over their own money/actions — and applies it, honestly, to
the rest of the gated features. Where it genuinely converts a risk, the mechanism is spelled out. Where it
can't (regulated regardless of consent), that's said plainly rather than faked. Not legal advice.*

## The pattern — why set-aside works

The set-aside bucket turned a risky mechanic safe with five moves:

1. **Voluntary, opt-in, off by default** — the user chooses it; nothing happens otherwise.
2. **Over the user's OWN money or actions** — it never creates a new obligation.
3. **Nothing owed, nothing locked** — fully reversible at any moment.
4. **Stays closed-loop / non-cashable** — no value leaves to a third party.
5. **The label explains itself** — no dark pattern, no pressure.

This works whenever the risk comes from something being **automatic or obligatory** that can instead be the
user's free choice. It does **not** work when the activity is regulated *no matter who consents* — moving
money to third parties, admitting minors, making unsubstantiated earnings claims, running a real card charge.
For those, an opt-in wrapper is exactly the unsafe "a disclaimer cures it" move, so they're flagged as hard
limits below, not dressed up.

## A. Convertible with the pattern — real fixes to build

### 1. Goods Advance (credit) → "Save-to-Get" item goal (user-routed, no debt)

**Risk today:** advancing goods now and recovering it from future earnings is **credit**.
**Reframe:** the user picks an item and *opts* to route a share of their own earnings toward it — a set-aside
bucket earmarked to that item. When the bucket reaches the price, they claim it. They still "use their
earnings over time to get goods," but they **pre-pay from their own Site Cash and receive the item when it's
funded**, and can redirect the bucket anytime. No advance, no balance, no repayment — so not credit.
**Build:** an "auto-save toward this" toggle on product pages (target = item price, source = a user-chosen %
of earnings), claim-when-funded. Reuses the set-aside engine plus the existing `ItemSavingsGoal` / `Layaway`
(the `layaway` flag is already ON). Lets you retire the gated `goods_advance` entirely.

### 2. Installment credit / Flexible Payment → already covered, no new credit

The no-debt "pay over time" need is met two ways that already exist: **Tier 1 Self-Paced** for the ad tiers,
and **Save-to-Get / layaway** for store items. So `flexpay` and `tier1_financed` can stay OFF permanently —
their goal is served without extending credit.

### 3. Buying points with cash (`store_credit_purchase`, money-transmission) → allocate your OWN earned credit

**Risk today:** selling points/credit for cash is **stored value / money transmission**.
**Reframe:** users never buy points; they earn them, and may voluntarily move their **own earned Site Cash**
between buckets (which set-aside already does). "Top up your balance" becomes "allocate what you've earned."
Same sense of control over a balance, with no cash-in and no stored-value sale. Keep the purchase path OFF.

### 4. P2P transfers (money transmission) → platform-funded "gift / boost" the user triggers

**Risk today:** user→user value movement is **money transmission**.
**Reframe:** a user may *choose* to send someone a reward, but the value flows **platform → recipient** (a
capped, non-cashable bonus the platform funds), never out of the sender's wallet. The sender spends effort or
their own non-cashable points to *unlock* a platform gift for a friend — the value the friend receives is the
platform's, not the sender's. This is the group-goals structure (already ON) applied to gifting: user-
initiated, but no value moves between users.
**Build:** a "send a boost" button → the platform grants the recipient a capped non-cashable bonus; the
sender optionally spends their own non-cashable points as the trigger.

### 5. Earnings projections (FTC earnings claims) → the user's own "what-if" calculator

**Risk today:** the platform stating "you'll earn $X" is a regulated **earnings claim**.
**Reframe:** the **user** enters their own target and assumptions; the tool shows a scenario built only from
**their own actual history**, labeled "your scenario — not a prediction or a promise." The platform asserts
nothing; the user models their own numbers. This extends the hypothetical→substantiated rule already in the
AI funnel. Keep platform-made `earnings_projections` OFF; ship the user-driven calculator instead.

## B. Hard limits — the pattern can NOT cure these (and why)

These are regulated regardless of who opts in. A user-choice wrapper would be misleading, so the honest path
is the second column, not a fake toggle.

| Gated feature | Why opt-in can't cure it | The real compliant path |
|---|---|---|
| **Card charging** | Needs a real processor / merchant account — infrastructure, not a consent choice. | Connect Stripe/PayPal + counsel, then flip it on. |
| **Teen accounts (COPPA)** | A minor's own consent isn't valid; only verifiable **parental** consent is. | The household model (adult-routed) already in place; add verifiable parental consent before admitting minors. |
| **Cash-out for regular users** | Paying cash out is money transmission + tax reporting (W-9/1099) regardless of opt-in. | Users stay closed-loop; only verified partners cash out, with the tax/licensing done. |
| **SMS marketing (TCPA)** | The compliant version *already is* user opt-in — it just needs verifiable consent captured. | Build the double-opt-in capture, then it's on. (This one is "set-aside-shaped" already.) |
| **Multi-level / chain referrals** | A pyramid/chain payout is unlawful no matter who opts in. | Single-tier referrals only (current default). |
| **Third-party BNPL (Affirm)** | It's a third party's regulated credit product; opting in doesn't change what it is. | Integrate the licensed provider if/when you want it; real shippable goods only. |

## Recommended build order (the convertible ones)

1. **Save-to-Get item goal** — reuses set-aside + layaway; retires `goods_advance`. Highest value.
2. **User "what-if" earnings calculator** — own-history only; replaces `earnings_projections`.
3. **Platform-funded gift / boost** — satisfies the P2P desire with no money transmission.
4. **SMS double-opt-in capture** — unlocks the already-compliant SMS path.

Each ships like set-aside: a labeled, self-explaining, opt-in control, off by default, over the user's own
money/actions, with nothing owed and full reversibility — and each lets a gated flag stay off for good rather
than waiting on a license.
