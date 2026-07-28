# Welcome Rewards + Member Value Stack

How to give new users a big headline number honestly, plus the full list of value you can offer that
**does not hurt your bottom line**, plus the exact figure to advertise and where to put it. Not legal
advice — run the final claims past counsel, and keep every number truthful (the FTC polices "free" and
inflated "value" claims).

---

## 1. The "Up to $1,460 in Welcome Rewards" promo — exact spec

It is a **promotional discount credit you fund**, not cash and not a loan. The headline works because
of "up to" + breakage (most users never redeem the full pool), so your real cost is a fraction of the
face value.

**Mechanics**
- **Face value:** $1,460 credit pool granted at signup (configurable).
- **Form:** non-cashable, non-transferable promotional credit. Applies as a **discount at checkout**,
  never withdrawable.
- **Per-order cap:** covers **up to 20%** of each qualifying order (store + marketplace platform
  items). So a $50 order gets up to $10 off; you never discount a whole order to zero.
- **Redemption pace:** at most one welcome-credit discount per order; can't be combined with the
  card-markup exemption or stacked on already-discounted clearance items.
- **Expiry:** **12 months** from signup; unused credit expires (this is what keeps the liability
  bounded and the cost low).
- **Eligibility:** one pool per verified account (18+), new users only; forfeited on account closure or
  fraud.
- **Excluded:** cash-out, points-to-cash, fees, affiliate/retailer-fulfilled items, and gift cards.

**Why it's affordable (illustrative, plug in your own numbers)**
- If the average user redeems ~10–15% of the pool before expiry (typical for capped, expiring promo
  credit), the **effective cost is ~$150–$220 per user who redeems at all**, and $0 for the large share
  who never do — spread further because the discount only ever covers 20% of an order you're already
  selling at a margin.
- Model it: `effective_cost ≈ pool × redemption_rate × (1 − your_margin)`. Tune the per-order cap,
  expiry, and eligible categories until the number is one you're happy with **before** you advertise it.

**Config (single source of truth — add to settings so every surface shows the same number)**
```
WELCOME_REWARDS_TOTAL=1460
WELCOME_REWARDS_MAX_PCT=0.20        # max share of any one order the credit can cover
WELCOME_REWARDS_EXPIRY_DAYS=365
```

---

## 2. The full value stack — 100% of the offers that don't hurt your bottom line

Each is tagged by **who pays**: **[Z]** zero marginal cost (you already serve it), **[P]** partner/
advertiser-funded (net-positive to you), **[B]** breakage/margin-funded (low effective cost), **[N]**
network/self-funding. Only include an item in an advertised total if the value is real and redeemable.

**Digital & informational — [Z] zero marginal cost**
1. Welcome Rewards credit (up to $1,460) — [B] breakage-funded discount.
2. AI shopping assistant / chatbot — [Z].
3. Personalized product recommendations — [Z].
4. AI "earnings coach" tips & daily goals — [Z].
5. Advanced earnings analytics dashboard — [Z].
6. Full catalog + category browse (40 departments, 900+ subcategories) — [Z].
7. Price-drop & deal alerts + wishlist — [Z].
8. Profile customization, avatars, badges (digital cosmetics) — [Z].
9. VIP / status tiers (perceived exclusivity) — [Z].
10. Earning guides & financial-literacy mini-courses — [Z] (one-time to make).
11. Early access to new features/games — [Z].
12. Localized experience: 56 currencies, 24 languages, your country's flag — [Z].
13. Buyer protection / AI-managed escrow on marketplace orders — [Z].
14. "Find the real thing" price-comparison search across major retailers — [Z].
15. Privacy controls: data export, delete, opt-out — [Z] (trust value).
16. Customer support + dispute resolution — [Z].
17. Community: forums, guilds, squads, leaderboards, tournaments — [Z].
18. Ad-free experience (only counts if you'd otherwise run ads) — [Z].

**Advertiser / partner-funded — [P] net-positive to you**
19. **Daily Boost (your idea):** earn **$4/day** in offers → unlock **5 minutes of free app use** with
    **no in-app-purchase charges** — a time-boxed window whose IAP cost is covered (up to a cap), funded
    by the advertiser revenue from those offers. Net cost ≤ $0 as long as the offer revenue ≥ the cap.
    **Implemented:** `dailyBoostStatus` / `claimDailyBoost` (opens a 5-minute `free_app_time_until`
    window + credit cap the game store honors at checkout).
20. Retailer cash-back via affiliate links — "up to X% back," network-funded — [P].
21. Offerwall sign-up bonuses & free trials — advertiser-funded — [P].
22. Free gift cards earned from completing offers — advertiser-funded — [P].
23. Sponsored contests & prize pools — brand-funded — [P].
24. Free product samples from brand partners — [P].
25. Sponsored premium membership (a brand covers a month) — [P].
26. Partner coupon codes / exclusive discounts — retailer-funded — [P].
27. Free entries to sponsored sweepstakes — [P].

**Breakage / margin-funded — [B] low effective cost**
28. Points bonuses (closed-loop; cost only on redemption, capped) — [B].
29. "Buy X get Y" / bundle deals — [B].
30. Free shipping over a threshold — [B].
31. Loyalty / volume discounts — [B].
32. Refund-as-store-credit (keeps value in-loop) — [B].
33. Seasonal promo credits — [B].
34. Cash-back-in-points on purchases — [B].
35. Daily login streak & challenge bonuses (points, capped) — [B].
36. Birthday/anniversary gift (points, capped) — [B].
37. Daily reward "spin" (points, capped; house-edge-free framing) — [B].

**Network / self-funding — [N]**
38. Referral rewards (the new user funds it) — [N].
39. Referral-squad / group bonuses — [N].
40. Creator/affiliate earnings — [N].
41. Streak multipliers — [N].

### The Daily Boost callout (your idea, made legal & net-neutral)
Frame it as: **"Earn $4 in offers today → your next 20 minutes are on us"** — a credit covering in-app
purchases and app-install costs **within GamerGain's own games/store** (not third-party App Store
charges, which Apple/Google control). Because the $4 comes from **advertiser offers that pay you**, the
credit you hand back is funded by that revenue, so it's net-neutral-to-positive. Keep the credit value
**below** your average offer payout so it never goes underwater, cap it per day, and word it as "on us
after you earn $4," not "free money."

---

## 3. The figure to advertise — and how to keep it accurate

**Hero number (recommended): "Up to $1,460 in welcome rewards."** It's honest because it's "up to,"
it's a real redeemable credit, and it's breakage-funded.

**Optional combined figure:** if you want a bigger first-year number, only add value that is genuinely
quantifiable and redeemable, each substantiated:

The **derived figure** (climbed as high as stays honest — each line is a real, accessible benefit):

| Component | Up-to value (yr 1) | Basis |
|---|---|---|
| Welcome Rewards credit | $1,460 | credit pool, "up to", expires 12 mo, ≤20%/order |
| Premium AI features (assistant, coach, analytics) | $120 | comparable tools ~$5–10/mo |
| Daily Boost free app time (5 min/day) | $180 | ~$1/active day, capped |
| Retailer cash-back (affiliate) | $100 | "up to X%" — conservative annual on typical spend |
| Free contest / sweepstakes entries | $60 | value of entries actually granted |
| Referral & streak bonuses | $80 | bonuses actually paid |
| **Total** | **≈ $2,000** | |

**Advertised figure: "Up to $2,000 in first-year value."** Stored in `ADVERTISED_VALUE_TOTAL` (default
2000) so every surface reads one number. It is defensible only **with "up to" + the disclosure + this
substantiation table** — do not publish a single number without them; that's the exact thing the FTC
challenges. The *typical* realized value is far lower (breakage); be ready to show this table if asked.

**FTC-safe rules for every surface**
- Always "**up to** $X," never "get $X."
- Keep a one-line disclosure: *"Value is the maximum available across welcome rewards and member perks;
  actual value depends on activity. Welcome rewards are non-cashable promotional credit that expires 12
  months after signup and cover up to 20% per order. See terms."*
- Never imply the rewards are cash or withdrawable.

**Where to use the figure (put the same number everywhere, from one config value)**
- Signup / landing hero: *"Join free — up to $1,460 in welcome rewards."*
- Onboarding first screen + progress toward unlocking.
- Welcome email subject/body.
- Push notification on signup.
- App store listing (see `STORE-LISTING-COPY.md`) — update the promo line.
- Ad creatives (Meta/Google/TikTok) — headline + the disclosure in the copy.
- Referral invites: *"Your friend gets up to $1,460 in welcome rewards."*

Single source of truth: store the number in `WELCOME_REWARDS_TOTAL` (and the combined figure in a
`ADVERTISED_VALUE_TOTAL` setting) so every surface reads one value and you can update it in one place.

---

## 4. What's built
- **Welcome-credit engine** — `welcome-credit.ts` (lazy-grant the pool at first touch, ≤20%/order cap,
  12-mo expiry), applied to platform-catalog purchases in `purchaseMarketplaceListing`; balance via
  `welcomeCreditStatus`. Cost is platform margin only (never subsidizes member sellers).
- **Daily Boost** — `dailyBoostStatus` / `claimDailyBoost` (earn $4/day → 5-minute free-app window +
  capped IAP credit the game store honors). Net-neutral, funded by offer revenue.
- **Advertised figure** — `ADVERTISED_VALUE_TOTAL` (default $2,000) + `WELCOME_REWARDS_TOTAL` ($1,460)
  as single-source settings; shown in the marketplace welcome banner with the "up to" + disclosure.
- **Affirm BNPL** — real-goods financing (see `AFFIRM-BNPL-SETUP.md`), with the "Pay over time with
  Affirm" button wired into the marketplace.
- **Most value items already exist** in the app (AI assistant, recommendations, referrals, contests,
  cash-back via affiliate, cosmetics, buyer protection) — which is what makes the figure substantiable.

### Remaining seams (need your data/keys, not new build)
- The game-store IAP checkout should check `free_app_time_until` / `app_time_credit_usd` to honor the
  free window (one guard in the IAP flow).
- Place the `ADVERTISED_VALUE_TOTAL` figure on the signup/landing hero and welcome email (the banner is
  live in the marketplace; reuse the same setting on other surfaces).
- Confirm the `DailyEarnings` field the boost reads matches your schema (it best-effort sums
  amount/earnings/total/usd).
