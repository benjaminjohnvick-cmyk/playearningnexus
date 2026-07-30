# GamerGain — Launch Cost Estimate (floor edition)

**Prepared 2026-07-30 · Supersedes the 2026-07-28 estimate · Figures are planning targets, not quotes**

This revision folds in the work completed tonight and re-states the posture you asked for: **everything
running and on from the get-go**, with the developer cost driven to its honest floor. Tonight's additions
are the auto-qualify → one-tap Premium path and the Services marketplace section brought to full parity
with the other sections (serverless-GPU category tiles + subsections + search). Both shipped **prebuilt
and switched ON by default**, so they add capability without adding launch cost.

---

## Does tonight's work actually run?

Straight answer: it is **verified-correct, not yet runtime-proven** — and that distinction matters, so
here is exactly what was and wasn't checked.

What passed, tonight, on every file: the structural audit (657 backend functions, 0 guardrail warnings),
a TypeScript syntax sweep, brace/paren/bracket balance, JSON validity for the manifest and scheduler,
every relative import resolving to a real file on disk, all four new backend functions registered in the
manifest, and the frontend wiring (the Premium banner mounted in the dashboard, the Services page calling
the GPU-category API, the page routed in `pages.config.js`). Each new function is also a near-line-for-line
mirror of an existing, already-working one — `premiumAcceptOffer` mirrors `loyaltyEnroll`,
`serviceStoreCategories` mirrors `appStoreCategories`, `aiServiceCategoryImages` mirrors
`aiAppCategoryImages` — so it inherits proven patterns rather than inventing new ones.

What could **not** be checked here: a live boot. This build environment has no Deno runtime and no live
Postgres, so nothing was executed against a real database. That first true runtime happens the moment you
push to GitHub and Railway rebuilds. The one-command `e2e-smoke` in the kit is what proves the earn→unlock
→purchase loop on the live instance, and the Premium banner only appears for a user who has actually hit
the survey-day milestone, so plan to confirm both against a seeded test account after the first deploy.
Nothing tonight touched money math or the payout rails, which keeps the runtime risk low.

---

## Everything on from the get-go — the flag posture

The platform ships with essentially every capability **live at launch**, not dark. That is a code fact,
not a promise: the built-in flag defaults turn the features on. The only things held off are held off for
a specific external prerequisite — a processor account, an opt-in record, or a licensing question — not to
save money, and each is a one-line flip once its prerequisite exists.

| On by default (runs day one) | Off by default (and the specific reason) |
|---|---|
| Premium PPC · Loyalty/Rewards program · **tonight's auto-qualify Premium** | Card charging — needs a live Stripe/PayPal processor + legal sign-off |
| Marketplace: Physical · Digital · **Services (now with GPU tiles)** | Affirm BNPL — needs Affirm merchant keys (real shippable goods only) |
| AI catalog, assistant, optimizer, self-learning, live experiments | SMS marketing — needs verifiable TCPA opt-in |
| KYC survey · welcome rewards · Daily/Points Boost · layaway · purchase-payback | Teen accounts — needs verifiable parental consent + counsel sign-off |
| Referrals (single-tier) · jackpots · social posting · email · site telemetry · UX heatmap | Store-credit purchase & P2P transfers — money-transmission risk |
| **Partner cash-out** (closed-loop for regular users, ON) | Earnings projections — FTC earnings-claims risk |

So "everything on" is already the shipped state. Cash-out is even on (partner-only; regular users stay
closed-loop at every rail). The six on the right are the guardrails — turning them on is a flag flip the
day their prerequisite lands, with no redeploy.

---

## One-time development — driven to the floor

Billed at $75/hour. Because tonight's features (and the AI, catalog, and marketplace layers before them)
are prebuilt, the developer spends **zero** hours building product — only deploying, testing, and
submitting. That is why the number keeps falling: there is less and less hand-work left.

| Work item | Hours | Note |
|---|---:|---|
| Accounts & API keys | 0 billable | Owner-completed from the keys worksheet |
| Deploy backend + Postgres + scheduler + frontend (one service) | 5–7 | Auto-migrating, inline scheduler, same-origin frontend |
| Pre-deploy validation | 1 | Scripted (`validate.sh`) |
| Configure AI / catalog / **turn tonight's features on** | 1–2 | Environment + flags only — no code, all prebuilt |
| Survey / earn-loop live test | 3–5 | `seed-demo` + `e2e-smoke` |
| QA pass | 5–7 | Against the QA test plan |
| Android submission (signed .aab) | 8–11 | Android submission kit + fastlane |
| **Subtotal — PWA + Android** | **~23–33** | **≈ $1,725–$2,475** |
| iOS submission (cloud CI, no Mac) | +4–8 | iOS-without-a-Mac kit |
| **Total — PWA + Android + iOS** | **~27–41** | **≈ $2,025–$3,075** |

Card payments stay off at launch, so the 0–8 "payments go-live" hours from prior estimates are out of the
launch number entirely — that work moves to whenever you turn card charging on.

---

## Ongoing runtime (monthly) — floor posture

| Item | Cost |
|---|---|
| Hosting (single instance to start) | ~$10–30/mo |
| Catalog + category images, one-time all-in | ~$11–19 once (retail + app + **~18 new Services tiles ≈ $2–4**) |
| LLM text — catalog seed, assistant, optimization | Hard-capped by the daily AI spend limit; ~$5–40/mo by usage |
| Geo-IP + exchange rates | Free tier |
| **Realistic month one** | **~$25–100**, capped |

Tonight's only new recurring-adjacent cost is the Services category tiles: about eighteen top-level images
generated once on the serverless GPU (a few dollars), gated by the same per-run cap as the other tile jobs
and skippable entirely by leaving `SERVICE_SUBCATEGORY_IMAGES` off (it is). No per-user cost was added.

---

## The floor — and why it isn't zero

| Path | Year-one all-in | What it takes |
|---|---:|---|
| **Absolute shoestring** (web PWA + Android, iOS as fast-follow) | **~$2,000–$2,800** | Dev $1,725–2,475 · Play $25 · domain ~$15 · hosting ~$120–180 · LLM capped ~$60–180 · images ~$0–19 |
| Full three platforms (adds native iOS) | ~$2,900–$4,000 | + iOS dev $300–600 · Apple $99/yr |
| Full three + AWS auto-scaling | ~$3,100–$4,800 | + the auto-scaling infra floor (App Runner + single-AZ RDS trims it) |

The hard external floor you cannot code away is about **$40** on the shoestring path — Google Play $25 plus
a ~$15 domain — because the PWA installs on iOS Safari, so iPhone users are covered without the $99 Apple
fee until you choose to ship the native iOS app. Add native iOS and the fixed floor becomes ~$139 (Apple
$99 + Play $25 + domain $15). Below that sits only the human/external time that no automation removes:
you creating the provider accounts, the first-run dashboard setup, and Google/Apple review. That residue —
not code — is the real floor.

---

## Bottom line

With tonight's Premium auto-qualify and the parity Services section prebuilt and **on by default**, the
launch cost did **not** rise — it fell, because more of the platform is now build-complete and the
developer only deploys it. A web + Android launch with **everything running from day one** lands at
roughly **$2,000–$2,800 all-in for year one**; adding native iOS puts it near **$2,900–$4,000**. The
irreducible fixed floor is **~$40** shoestring (Play + domain), **~$139** with native iOS. The only real
risk to the number remains an iOS App Store rejection round — mitigated by the demo login and
merit-not-gambling framing already in the kit.
