# Launch-Time Activation Checklist — AI Models & Autonomy

*Everything built this session ships **inert-safe by default** (frontier model off, gateway off, autonomy
advisory until the site is live). This is the ordered checklist to turn it on when you launch — and the honest
note on what each step costs or commits you to. Do these in order. Not legal advice.*

---

## 0. Before you flip anything

- [ ] Confirm the build is deployed and green (`node deploy-kit/audit.mjs` passes; the app boots).
- [ ] Open the two admin screens you'll use: **Platform Settings** (admin) and **Autonomy Oversight** (admin nav).
- [ ] Read the two status endpoints once so you know the baseline: `aiModelStatus` and `autonomyOversight`.

## 1. Models — optional, and it costs money

The platform runs fine on the cheap default (Llama on Groq's free tier). Turn on more only if you want it.

- [ ] **Stay cheap (default):** leave `LLM_PROVIDER=groq` and `AI_FORCE_CHEAP_TIER` **ON**. Nothing to do.
- [ ] **Enable Astra for hard jobs (spends real money):** add your `OPENAI_API_KEY` (with Astra access), set
      `AI_FORCE_CHEAP_TIER` **OFF**, and point the jobs you want at it (`AI_JOB_MODEL_DOCUMENT=astra`, etc.).
      Watch `AI_DAILY_SPEND_CAP_USD` — Astra is ~$10/$50 per M tokens.
- [ ] **Use a gateway ("all models, always latest"):** set `LLM_PROVIDER=gateway`, `AI_GATEWAY_URL` (an
      OpenRouter-style endpoint), and `AI_GATEWAY_KEY`. Then bump `GATEWAY_MODEL_*` ids as new models ship.
- [ ] **Verify:** `aiModelStatus` shows the provider, the per-job routing, and `frontier_active: true` only when
      you meant to enable it.

## 2. Autonomy — the sequence that lets it start running itself

Until the site is live, every gated action correctly **queues** instead of firing. Turn it on deliberately.

- [ ] **Keep the safety rails set:** `AUTONOMY_ENABLED` ON, `AUTONOMY_KILL_SWITCH` **OFF** (flip ON anytime to
      freeze everything), and the trust bars at their defaults (`AUTONOMY_TRUST_MIN_RUNS` 10,
      `AUTONOMY_TRUST_MIN_AGREEMENT` 0.8, `AUTONOMY_TRUST_MIN_DATA` 200).
- [ ] **Go live:** set `SITE_LIVE` **ON**. This moves the global gate from "advisory" to active — gated actions
      can now run once their domain earns trust. (`AI_APPLY_WHEN_LIVE` stays ON.)
- [ ] **Choose the starting posture:** `AUTONOMY_AUTO_OK_DEFAULT_MODE` = `earned` is the safe default (domains
      must earn autonomy from your approvals). Use `manual` to approve everything yourself at first, or `full`
      only once you trust a domain. The **permanent-gate spine ignores this entirely** and always waits for you.
- [ ] **Set the stale-window:** `AUTONOMY_PENDING_STALE_HOURS` (default 24) — how long before a waiting approval
      is flagged as an exception.

## 3. The operating rhythm (this is what makes domains graduate)

The five gateable domains — content calendar, homepage personalization, ad-slot reallocation, catalog rotation,
survey distribution — earn autonomy from **your approvals**, so graduation is paced by how you review.

- [ ] Each day (early on), open **Autonomy Oversight**, work the **pending queue**, and clear the **exceptions**
      (failures, stale items, domains not earning trust, spend).
- [ ] Approve cleanly where you agree — a domain graduates after ~10 clean approvals at ≥80% agreement, so a few
      reviews a day gets a domain to auto in ~1–3 weeks.
- [ ] Watch the **"Loop routed"** tile (100% of gateable wired) and the per-domain dots (ring = actually firing).
- [ ] If anything looks wrong, hit the **kill switch** — everything reverts to waiting for you, instantly.

## 4. What you are NOT turning on (by design)

- Money out, refunds, billing, advertiser billing, KYC/tax, disputes, bans, security config, and legal/public
  content are **permanent gates** — they never auto-run regardless of these settings. That's the compliance
  spine; leave it.
- Read-only reporting/monitoring and on-demand generation aren't gated — they run normally.

## 5. Related

- `AI-MODEL-MODULE-AND-AUTONOMY-MAP.md` — the model router + full domain map.
- `AUTONOMY-GATING-AND-OVERSIGHT.md` — the gate + dashboard + coverage model.
- `LAWYER-CONVERSATION-GUIDE.md` — the items to confirm with counsel before/at launch.
- `ADMIN-SETTINGS-README.md` — the full settings reference.

*Not legal advice — confirm the launch posture with counsel (see the lawyer guide).*
