# Everything is ON, up, and running from the get-go

This is the core operating posture of GamerGain / PlayEarning Nexus, and it governs every estimate, guide,
and deploy step in this bundle. **Read this first — it is the assumption behind all the numbers.**

## The rule

There is **no build phase left**. The product ships **feature-complete and switched ON by default**. A
deploy is not "assemble the app" — it is "turn the key on an app that is already whole." From the moment it
is deployed and the doors are opened, every feature below is live, populated, and self-running for the very
first user.

## What "on from day one" means in practice

- **Every feature flag defaults to ON** in code (`backend/.env.example`), so a fresh deploy comes up with the
  full product enabled — marketplace (physical, digital, services), surveys + verified surveys, premium PPC +
  loyalty, group goals, earn-back discount, financed Premium, buddy/group chat with translation, leaderboards,
  the full AI layer (assistant, catalog seeding, optimizer, self-learning), referrals, jackpots, and more.
- **The site pre-warms itself.** `deploy-kit/go-live.mjs` seeds the catalog and surveys with real content
  **before the first user arrives**, and the 37 scheduled jobs run automatically — so nobody lands on an
  empty app.
- **The whole AI/media/email layer is live at $0** on free tiers from the first request (Groq LLM + speech,
  Cloudflare images, Polly/cache voice, Brevo/SES email), each with graceful fallback so it works even before
  a key is added.
- **No feature waits on "phase 2."** Everything a user can do, they can do on launch day.

## The only things intentionally held OFF (each a one-line flip, not a build)

These are compliance guardrails, not missing work. Each turns ON the day its external prerequisite is real:

- Card charging → live payment processor + legal sign-off
- Partner cash-out (`cash_out`) → live merchant account + counsel
- P2P transfers / bought store-credit → money-transmission counsel
- SMS marketing → verifiable TCPA opt-in
- Teen accounts → parental-consent flow + counsel
- Earnings projections → FTC earnings-claims review
- Earn-back "quit → Site Cash" stored-value treatment & attempt-based daily requirement → counsel sign-off

The earn-and-spend closed loop launches **fully** without any of these.

## Why the estimates are what they are

Because everything is prebuilt and ON, the launch cost is **deploy + test + submit only** — no product
development. That is why year-one lands at ~$1,800–$2,800 all-in (developer labor separate), with the
AI/media/email layer at **$0/mo** on free tiers and hosting the only recurring cost (~$5–20/mo). Every
estimate in this bundle assumes this posture: **on, up, and running from the get-go.**
