# Hiring Kit — GamerGain / PlayEarning Nexus
Two things you can use right away: a **job post** to publish (Upwork/LinkedIn/etc.), and a set of
**screening questions** (with what a good answer looks like) to make sure a candidate actually knows
the stack before you hire.

---

## PART 1 — Job Post (copy/paste, edit the [brackets])

**Title:** Full-Stack Dev to Deploy & Launch an Existing Web + Mobile App (Deno + Postgres + React + Capacitor)

**Overview**
I have a finished codebase for a play-to-earn web app (surveys, games, referrals, rewards) and need
an experienced full-stack developer to **deploy it and ship it to web + the app stores**. The code is
written and on GitHub — this is a configuration, integration, deployment, and app-submission job, not
a build-from-scratch project. I have a complete handoff brief and setup docs ready for you.

**The stack**
- Frontend: React + Vite PWA (already built)
- Backend: self-hosted **Deno** service — 526 HTTP function routes, JWT + Google auth, an agent
  runtime, a cron scheduler (Docker + docker-compose included)
- Database: **PostgreSQL** (schema is generated and validated)
- Native apps: **Capacitor** wrapper for Android + iOS
- Integrations to wire (I provide the API keys): Stripe, PayPal, Twilio, an LLM provider
  (OpenAI/Anthropic), email (SendGrid/SES), Google OAuth, S3

**What you'll do**
1. Boot the backend locally (docker compose), run the included smoke test, fix any DB query edge
   cases that surface.
2. Wire my API keys into the backend/frontend env and verify test-mode payments, email, and LLM.
3. Deploy: managed Postgres + a container host for the Deno backend + static hosting for the
   frontend, with a custom domain + HTTPS.
4. Configure user accounts/auth (JWT, email password-reset, optional Google sign-in).
5. Build and submit the Android and iOS apps (Capacitor → Android Studio / Xcode). **iOS requires a
   Mac.**
6. Final QA against my go-live checklist.

**What I provide**
- Full source on GitHub + a one-page developer handoff brief + detailed setup/runbook docs
- All third-party accounts and API keys, ready to paste
- Domain, hosting budget, Apple Developer + Google Play accounts, finished legal pages

**Requirements**
- Strong React + Node/**Deno** and **PostgreSQL** experience
- Have shipped at least one app to the **Apple App Store and Google Play** (Capacitor/Cordova/RN)
- Comfortable with Docker and a modern host (Render/Railway/Fly.io/AWS)
- Clear communicator; can work from written docs

**Nice to have:** experience with payments (Stripe/PayPal), earn-money/rewards app store policies,
serverless/JWT auth.

**Scope & budget:** Estimated **~7–13 working days**. Please quote **fixed-price for the milestones
below**, or an hourly rate + estimated hours. Milestones: (1) running locally + smoke test green,
(2) deployed to a staging URL, (3) production web launch, (4) both apps submitted.

**To apply:** In 3–4 sentences, tell me (a) an app you shipped to both stores and your role, (b) how
you'd host a Deno backend + Postgres, and (c) your estimate for this scope. Applications that just
say "I can do this" will be skipped.

---

## PART 2 — Screening Questions (with what a good answer looks like)

Use these in a short written reply or a 20-minute call. You're checking they actually know the
specific stack — a strong candidate answers these easily; a weak one gets vague.

**1. "The backend runs on Deno, not Node. How do you deploy a Deno service, and how is it different
from deploying a Node app?"**
✅ Good: mentions Deno's built-in permissions (`--allow-net/env/read`), running via the provided
Dockerfile on a container host (Render/Fly/Railway/Cloud Run), that there's no `npm install` /
`node_modules` step the same way, and Deno uses URL/`npm:` imports. 🚩 Weak: "it's basically the same
as Node" with no specifics, or assumes a Node buildpack will just work.

**2. "It's a document-style Postgres schema (data in JSONB). How would you make a query like 'find
active rows for this user' fast?"**
✅ Good: GIN index on the JSONB column, containment (`@>`) queries, promoting hot fields to real
columns/indexes, `EXPLAIN` to confirm index use. 🚩 Weak: "add an index" with no mention of JSONB/GIN,
or wants to redesign the whole schema.

**3. "You need to ship this exact web app to the App Store and Play Store. Walk me through it."**
✅ Good: Capacitor `cap add/sync`, Android signed `.aab` via Android Studio + keystore safekeeping,
iOS archive in Xcode on a Mac + App Store Connect, and knows **earn-money apps get extra review**
(privacy labels, IAP rules, demo account for reviewers). 🚩 Weak: only knows one platform, or doesn't
mention signing/keystore or review requirements.

**4. "How would you set up JWT auth and Google sign-in for this, and store passwords safely?"**
✅ Good: verify a signed JWT per request, hash passwords (bcrypt/scrypt/argon2 or salted SHA), verify
Google ID tokens server-side (aud check), never trust the client. 🚩 Weak: storing plaintext or
comparing passwords client-side; can't explain token verification.

**5. "The app calls Stripe, PayPal, Twilio, and an LLM API. How do you keep those keys safe and stop
the app from breaking when a provider rate-limits you?"**
✅ Good: secrets in server env / a secrets manager (never in the repo or frontend bundle), a queue or
concurrency limiter with retry/backoff on 429s, test-mode first. 🚩 Weak: putting secret keys in the
frontend, or no idea about rate-limit handling.

**6. "My first ask is to run it locally and run the smoke test before deploying. Why does that order
matter?"**
✅ Good: de-risks cheaply — catches integration/DB issues on localhost before paying for infra and
before app-store submission; a broken build shouldn't be discovered in production. 🚩 Weak: wants to
deploy first, or dismisses local testing.

**7. (Judgment) "The docs say the reward/prize pool must stay skill/merit-based, not gambling. Why
would a developer need to care about that?"**
✅ Good: understands it affects app-store approval and legal/compliance, not just code — won't
"optimize" it into a random draw. 🚩 Weak: treats it as irrelevant to their job.

**Red flags overall:** won't read documentation; wants to rewrite the whole thing "properly" before
launching; has never shipped to an app store; evasive about the Deno/Postgres specifics; quotes a
price without asking a single clarifying question.

**Green flags:** asks to see the repo and the handoff brief, asks clarifying questions about hosting
budget and which LLM/email provider you want, gives a milestone-based estimate, and has real store
links to apps they've shipped.
