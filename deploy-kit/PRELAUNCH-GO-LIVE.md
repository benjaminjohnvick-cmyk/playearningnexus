# Pre-Launch "Go-Live" — everything ON and populated before your first user

> **Posture: everything is ON, up, and running from the get-go** — the product ships feature-complete with every flag ON by default and pre-warms its own content, so launch is deploy/test/submit, not build. See `EVERYTHING-ON-FROM-DAY-ONE.md`.

This is the last kit step before you open the doors. It answers one question with one command:
**"Is the app fully up, switched fully on, and already full of content — ready for a real user right now?"**

The app is built **on-by-default**: the launch config (`backend/.env.example`) ships every feature ON,
and the 37 scheduled jobs (catalog seed, AI advertiser, optimizer, payouts, jackpots…) run themselves
under `SCHEDULER_INLINE=1`. The only gap between "deployed" and "ready for users" is that a brand-new
deploy starts with an **empty catalog** until the first scheduled seed tick fires. `go-live` closes that
gap: it **pre-warms** the site with real content immediately, verifies everything is on, and self-tests.

## Run it

```
BACKEND_URL=https://your-backend \
ADMIN_EMAIL=you@yoursite.com ADMIN_PASSWORD=your-admin-password \
node deploy-kit/go-live.mjs
```

Optional:
- `PREWARM=aiCatalogSeed,aiCategoryImages` — add category images (they cost a little AI spend; default is catalog only, $0-ish).
- `SEED_COUNTRIES=US` — seed just one country to start (cheapest, instant breadth).
- `SKIP_SMOKE=1` — skip the end-to-end smoke child run.

## What it does (all existing endpoints — no new backend code)

1. **Posture** — `/health` is green, the scheduler is inline, the SPA is served.
2. **Admin sign-in** — logs in with your admin account to do the authed steps (skips gracefully if omitted).
3. **Everything-ON check** — reads `complianceFlags` and lists any feature that is OFF, so nothing you
   wanted on is silently off. (Some flags are *meant* to stay off until a prerequisite is met — see below.)
4. **Pre-warm** — triggers `aiCatalogSeed` (and optionally `aiCategoryImages`) once, so the storefront and
   surveys are **populated before the first user arrives**, then confirms the marketplace has live listings.
5. **Critical-path smoke** — runs `e2e-smoke.mjs` (signup → survey → store → payout → PPC → ads → boost).
6. **Verdict** — prints **GO** or **NOT YET** with the exact blockers, plus the two owner flips that open
   the doors.

## The two flips that actually open the doors (owner decision)

Everything else is automated; these two are deliberately yours to make, one line each:

1. **Payments live** — switch Stripe/PayPal to live keys. Leave `cash_out` **OFF** until you have a live
   merchant account **and** counsel sign-off (partner cash payouts are the one rail that touches real money).
2. **Open the site** — turn `MAINTENANCE_MODE` **OFF** in the admin panel so the public can sign up.

## Flags that are intentionally OFF at launch (leave them, by design)

The go-live report may list these as OFF — that is correct, not a miss. Turn each ON only once its
prerequisite is real:

- `cash_out` — partner cash payouts. Needs a live PayPal/Stripe merchant + partner W-9/1099 + counsel.
- `p2p_transfers`, `store_credit_purchase` — user-to-user value / bought stored value. Need counsel sign-off
  (money-transmission questions). The earn-and-spend closed loop launches fully without them.

## Where this fits in the kit

Run it **after** `launch.sh` has deployed and smoke-tested, as the final gate before flipping
`MAINTENANCE_MODE` off. `launch.sh` now calls it automatically as its last step when `BACKEND_URL` and
admin creds are present.
