# Premium daily portion + all survey providers ON (from the get-go)

Two launch-posture decisions, both live in code and ON by default.

## All survey providers ON from day one

All **11 survey networks** default **ON** (`PROVIDER_*_ENABLED = 1`): BitLabs, CPX Research, TheoremReach,
Pollfish, InBrain, TapResearch, Cint/Lucid, AdGate, ayeT-Studios, Revlum, Prodege.

The router (`backend/sdk/survey-providers.ts`) only serves a network that is **BOTH enabled AND configured**
(has its API key). So a network with its flag on but no key stays **inert** — zero risk, nothing breaks —
and goes **live the instant its API key lands**. That is what "ready to go from the get-go" means here: no
code change later, just add the key.

- **BitLabs is keyed at launch** (the one live network on day one).
- The other ten are armed and waiting on (a) a signed publisher contract with each network and (b) their
  `<PROVIDER>_API_KEY`. Turning the flag on does not create the business relationship — it just means the
  moment you have the key, the network serves inventory immediately.

## Premium daily portion — $7/day (member keeps all of it)

A premium member's daily **portion** is **$7/day**, and they keep the **full $7** — it is **closed-loop
Site Cash** (spendable on-site, non-withdrawable), never a cash payout.

- **Setting:** `PREMIUM_DAILY_PORTION_USD = 7`. The daily earn cap is now tier-aware — premium $7, non-premium
  `EARN_DAILY_CAP_USD` ($8).
- **The $1/day subscription fee is ON TOP**, covered by the **prepaid annual subscription** — it is **not**
  deducted from the $7. The member nets the full $7.
- **Annual member portion:** **minimum $1,820** ($7 × 5 days/week × 52) up to **maximum $2,555**
  ($7 × 365 days). Pick a day-count expectation between those bounds.

### Prepaid vs financed premium (both supported)

- **Prepaid** (this model): the member pays the annual subscription **up front** (operator receives the money
  up front). The $1/day sub is covered by that payment; the member simply earns their $7/day portion.
- **Financed** (built earlier, `premium-finance.ts`): **no upfront** — $1/day is pulled from earnings toward
  the subscription, with any overpayment returned as Site Cash and under-earning downgrading to free.

The $7/day member portion is identical either way. Prepaid gets the money up front; financed lowers the
signup barrier. Both can coexist as two ways to pay for the same tier.

## Compliance line (held)

The $7/day portion is **Site Cash — closed-loop, non-withdrawable.** It is deliberately **not** a cash payout.
Taking a member's prepaid money and paying it back as **daily cash** would be deposit-taking / money
transmission (and, if funded by other members' prepayments, Ponzi-adjacent). If real-cash daily payouts are
ever wanted, that requires counsel and likely a money-transmitter analysis before it can be enabled.
