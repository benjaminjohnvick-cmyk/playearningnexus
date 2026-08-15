# Premium Gift Boost — Advertising Copy, Disclosure & Terms

*A ready-to-review package for advertising the premium gift boost online and on-site. It's drafted to the
FTC's advertising rules (accurate "up to" claims, clear-and-conspicuous disclosure of material conditions,
no "free"/cash implications, ability to substantiate). **Not legal advice** — have counsel approve this exact
wording, and confirm each ad platform's own incentive-advertising policies, before running anything.*

## Ground rules this copy follows (why it's written this way)

- **"Up to $2,000," never a flat "$2,000."** The cap is $2,000 per premium member; individual amounts depend
  on availability, so the max is stated as a ceiling, not a promise everyone receives.
- **"Store credit," never "cash."** It's non-cashable and spends only on-platform, so we never imply cash or
  withdrawable value.
- **A gift/bonus, never "earn."** It's a platform/advertiser-funded promotional credit — not earnings — which
  keeps it clear of FTC earnings-claim rules. Never say "earn $2,000."
- **Not "free."** It's a premium-member benefit (requires a paid membership), so we don't call it "free"; the
  premium condition is disclosed with the claim.
- **Only advertise what we can deliver.** The boost is funded by advertisers into a tracked pool; copy is
  paired with an availability disclosure so it isn't bait advertising.

## (a) Ad-copy variants

### Online ads (short — headline + primary text)

Each headline needs the disclosure (section b), at least in short form, in the same ad or its landing page.

1. **Headline:** Premium members: up to $2,000 in store credit
   **Primary:** Go premium and get up to $2,000 in advertiser-funded store credit to spend on the platform.
   Non-cashable; premium required; subject to availability. See terms.

2. **Headline:** A $2,000 boost, on us (well — on our advertisers)
   **Primary:** Our advertisers fund a gift boost of up to $2,000 in store credit for premium members. Pick
   what you spend it on. Non-cashable store credit; premium membership required; while funds last.

3. **Headline:** Premium perk: up to $2,000 to spend
   **Primary:** Premium membership comes with up to $2,000 in advertiser-funded store credit — you choose how
   much to use and on what. Not cash; subject to availability. Terms apply.

4. **Short/social:** Premium = up to $2,000 in store credit, funded by our advertisers. Non-cashable, premium
   required, while funds last. [See terms]

### On-site (hero + subhead + CTA)

**Hero:** Up to **$2,000** in store credit — a premium gift boost
**Subhead:** Funded by our advertisers, for premium members. You choose how much to use and which items to put
it toward. It's non-cashable store credit, and you never owe anything.
**CTA:** Go Premium  ·  secondary: See how the boost works
**Directly under the hero:** the full disclosure block (section b).

## (b) Clear-and-conspicuous disclosure block

Place this immediately adjacent to any "$2,000"/"up to $2,000" claim — same screen, comparable prominence,
not a far-away footer. Short form for tight ad units; full form on landing pages and the on-site hero.

**Short form (for small ad units):**
> Up to $2,000 in non-cashable store credit for premium members, funded by advertisers. Amount varies and is
> subject to availability. Premium membership required. Not cash. Terms apply.

**Full form (landing pages / on-site, directly under the claim):**
> **About the premium gift boost.** The gift boost is **up to $2,000** in **non-cashable store credit** for
> **premium members** — it is **not cash** and cannot be withdrawn or transferred. It is **funded by our
> advertisers** and is a promotional benefit, **not earnings**. The amount available to you depends on your
> eligibility and on how much advertiser funding is currently available, so **individual amounts vary and the
> boost is subject to availability (while funds last)**. A **premium membership is required** to claim it. You
> choose how much of your boost to use and which items to apply it to; you owe nothing, and any credit you
> don't use stays available for later. Full terms: [link].

## (c) Short terms page

> ### Premium Gift Boost — Terms
>
> 1. **What it is.** The premium gift boost is a promotional grant of **up to $2,000 in non-cashable store
>    credit** ("boost credit") for eligible premium members, funded by contributions from the platform's
>    advertisers. It is a gift/loyalty benefit — **not** earnings, **not** cash, **not** a loan or advance.
> 2. **Eligibility.** You must have an active premium membership. Each eligible member may receive up to
>    $2,000 in total (the cap is set by the platform and may change prospectively).
> 3. **Availability.** The boost is funded from a limited, advertiser-funded pool. Amounts are granted while
>    funds are available; if the pool is exhausted, further claims may be unavailable until it is replenished.
>    The platform does not guarantee that any particular amount up to the cap will be available at any given
>    time.
> 4. **Non-cashable store credit.** Boost credit can be applied only to eligible purchases on the platform. It
>    **cannot** be redeemed for cash, withdrawn, or transferred to another person, and it carries no cash value.
> 5. **How to use it.** You choose how much of your boost credit to apply and to which eligible items. Applying
>    it reduces the cost of those items by the amount applied. Unused credit remains available until used,
>    subject to any expiration stated at grant.
> 6. **No obligation.** Claiming or using the boost creates no debt and nothing is owed. You are never charged
>    for the boost.
> 7. **Changes / end of program.** The platform may modify, suspend, or end the program, or change the cap and
>    terms, prospectively and for any reason, consistent with applicable law. Changes do not reduce credit
>    already granted.
> 8. **Fraud / abuse.** Boosts obtained through fraud, abuse, or violation of the platform's terms may be
>    reversed, and accounts may be suspended.
> 9. **Not an offer where prohibited.** The boost is void where prohibited and is subject to all applicable
>    laws and the platform's general Terms of Service and Privacy Policy.

## Platform-policy checklist (separate from the law)

Before running paid ads, confirm the copy also complies with each network's incentive/financial-promotion
policies (these are often stricter than the FTC): Google Ads, Meta, TikTok, etc. In particular, some networks
restrict "money"/"cash"/"reward" imagery and require the conditions in the ad creative itself, not only the
landing page.

## Where these strings live in the product

The on-site hero + disclosure are wired on `/PremiumBoost` (see the disclosure block rendered under the
claim). Keep the ad copy, the on-site hero, and this doc in sync — if you change the cap
(`PREMIUM_GIFT_BOOST_MAX_USD`) or the availability model, update all three.
