# The $1,050 Floor Plan — full launch, everything ON, up and running at launch

**Goal:** a complete launch — web PWA **+ Android + iOS**, with **every feature switched ON and the site
already populated with content** on day one — for a developer bill at the **floor of ~$1,050** (14 h @
$75/hr). This is the low end of the kit's honest floor, and it's reachable *because* everything below is
now scripted, everything is on-by-default (so there are no "enable the features" hours), and the owner
does the account signups (which are never billable dev work).

> Honest caveat up front: $1,050 is the **clean-run floor**. The one thing no script controls is an
> **Apple review rejection round** — it's the only realistic way to drift toward the high end. The kit
> attacks that risk directly with pre-written reviewer notes, a demo login, and merit-not-gambling framing
> (below), which is how a first-pass approval — and therefore the floor — is won.

---

## Why "everything ON" costs $0 extra

The launch config **is** the defaults. `backend/.env.example` ships every feature ON (premium PPC + the
up-front grant, AI advertising + its learning loop, one-tap posting, survey make-up, optimizer/live
experiments, KYC survey, points boost, physical/digital store, layaway, jackpots, email), and the 37
scheduled jobs run themselves under `SCHEDULER_INLINE=1`. The developer **sets a variable, not builds a
feature** — so turning everything on adds **nothing** to the estimate. `go-live.mjs` then pre-warms the
catalog so the site is **full of content before the first user**, in one command.

The only things OFF at launch are the ones that *should* be — `card_charging`, `cash_out`,
`store_credit_purchase`, `p2p_transfers`, `teen_accounts` — each gated behind a processor or legal
prerequisite, each a one-flag flip later, never a rebuild. Their being off is a launch *enabler*, not
missing work.

---

## The 14 hours, itemized (everything else is automated or owner/one-time)

| Remaining developer work | Hours | What makes it the floor |
|---|---:|---|
| Railway: create project + Postgres + first deploy | 2 | `web-launch.sh` → `railway-deploy.sh` (or the one-click Railway button) provisions + pushes env + deploys |
| Go-live: flags ON + pre-warm content + smoke | 0.5 | `node deploy-kit/go-live.mjs` — one command, self-verifying |
| Mobile signing secrets (Android keystore + iOS/Play) | 1.5 | `deploy-kit/mobile/setup-signing.sh` generates the keystore + writes the exact paste-ready CI secrets |
| Android build + upload to Play | 2 | CI builds on push to `android-release`; `fastlane` uploads with metadata/screenshots |
| iOS build + upload to TestFlight/App Store (no Mac) | 3 | Cloud CI (`ci/ios-build.yml` / Codemagic) + App Store Connect API key |
| Store listings + submit (both) | 2 | Copy is pre-written; screenshots scripted (`gen-screenshots.mjs`); reviewer notes pre-written |
| Final go-live + open registration | 1 | Flip payments (optional; closed-loop needs none) + `MAINTENANCE_MODE` off |
| **Total** | **~12** | **≈ $900** |
| Buffer for one clean review response cycle | +2 | keep it to ~$1,050 |
| **Floor target** | **~14 h** | **≈ $1,050** |

Not billable dev (owner / one-time / not code): creating provider accounts and pasting keys, the Apple
$99 + Google $25 + domain fees, optional legal review of the (provided) privacy/terms, and Apple/Google's
**review wait** (calendar time, not dev hours).

---

## The whole thing as commands (the floor path)

```
# 0) Owner one-time: create accounts, fill backend/.env (keys + ADMIN_EMAIL/ADMIN_PASSWORD),
#    npm i -g @railway/cli && railway login

# 1) Deploy + turn on + pre-warm + smoke, in one command:
bash deploy-kit/web-launch.sh

# 2) Mobile signing in one command, then paste the secrets it writes into GitHub Actions:
bash deploy-kit/mobile/setup-signing.sh

# 3) Build the apps (push to the release branches, or run the Actions jobs):
#    android-release → signs + uploads to Play;  ios-release → builds + uploads to TestFlight
#    Submit with the pre-written listing copy + deploy-kit/REVIEWER-NOTES.md

# 4) Open the doors:  turn MAINTENANCE_MODE OFF in the admin panel.
```

## What protects the $1,050

1. **Everything ON is the default** — zero feature-enablement hours.
2. **One-command deploy + go-live** — the deploy/QA/pre-warm phases collapse to minutes.
3. **One-command signing** — the fiddliest mobile step is scripted.
4. **Pre-written listing copy + reviewer notes + demo login** — submission is paste-and-go, and the review
   is set up to pass first try (the only real risk to the floor).
5. **Closed-loop at launch** — no payment-processor wiring or compliance blocker on the critical path.

## What can still add hours (be honest)

- An **Apple review rejection round** — the one thing outside the kit's control. Keep the review clean
  (demo login, merit-not-gambling framing, 18+, privacy answers) to avoid it.
- A **messy provider approval** (e.g. a payment or Play service-account delay) — calendar time; do the
  owner signups early so they're ready when the developer starts.

**Bottom line:** with the kit at this level, a full PWA + Android + iOS launch with **everything on and the
site already live with content** lands at the **~$1,050 floor** on a clean run — and a web-only soft launch
(defer the apps) is lower still (~$750–$1,200). Runtime stays capped by `AI_DAILY_SPEND_CAP_USD` and can
launch at ~$0.
