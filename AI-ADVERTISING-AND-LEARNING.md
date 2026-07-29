# AI Advertising & Self-Improvement Loop

_Version: GamerGain 8 · 2026-07-29. How the Premium PPC AI advertiser generates ads, posts them under
consent, and learns from outcomes using the platform's existing AI-learning infrastructure. **Not legal
advice** — the social-posting model requires the platform/FTC review flagged below._

## 1. What the AI advertiser does

Once per day (scheduled job `daily-premium-ppc-autoadvertise`, 10:30 UTC → `premiumPPCAutoAdvertise`), for
each **paying advertiser that has not yet doubled** its investment, the AI writes a short, upbeat, already
`#ad`-disclosed social post for that advertiser's product and **queues** it on the connected social
accounts of **consenting** survey-members. It also queues a **daily post for the platform's own business**
to those same accounts. Free to the advertiser until they've doubled (received $10k in orders); after
that they stop.

Guardrails baked in:
- **Consent-gated.** Only members with `ppc_social_ads_opt_in` and a real OAuth-connected account are
  targeted (see SOCIAL-POSTING-ONE-TAP-AND-CONSENT.md).
- **Approval by default.** Posts default to `pending_approval` (`PREMIUM_ADS_REQUIRE_APPROVAL`), so the
  member one-taps to approve — never silent auto-posting unless an admin explicitly flips that off.
- **Disclosure appended.** Every generated post runs through `withAdDisclosure()` (`#ad · Sponsored`).
- **Kill switches.** Respects the `social_posting` feature flag and per-run caps
  (`PREMIUM_ADS_MAX_POSTS_PER_RUN`, `PREMIUM_ADS_USERS_PER_ADVERTISER`).
- **Spend cap.** All ad-copy generation runs through `InvokeLLM`, which enforces `AI_DAILY_SPEND_CAP_USD`.

## 2. How it plugs into the platform's AI learning (the key design point)

The ad engine does **not** have a private learning system. It writes to and reads from the **same**
primitives every other AI agent on the platform uses, so it appears in the same oversight feed, the same
learning dashboard, and the same self-learning grounding — with **no new database tables**.

**Outcomes in.** When a member acts on a queued ad (`premiumAdDecide`), the decision becomes learning
signals via `sdk/ad-learning.ts → recordAdOutcome()`:
- a weighted **`OptimizationSignal`** (`kind: "ad_outcome"`) — auto-post `+3`, hand-post `+2`, skip `−1`,
  keyed by `ad:<platform>:<post_type>`; this is the same signal type the optimizer / self-learning
  grounding already consume.
- a durable **`AgentLearningMemory`** lesson under agent name **`ppc_ad_ai`**, so the agent trends in
  `learningInsights` (per-agent success rate) and is rolled up by `learningDistill`.
- A skip is a **negative signal, not a deletion** — the AI learns to change copy or platform mix.

**Learning out.** Before composing the next batch, `premiumPPCAutoAdvertise` calls
`adLearningInsights()` and uses it to:
- **prioritize platforms** members actually post to (`prioritizeByLearning` orders connections so the
  per-run cap favors high-performing platforms), and
- **show the model exemplars** — recent copy members chose to post is fed into the generation prompt
  ("match this tone/length, don't copy verbatim"), so output drifts toward what works.

**Human oversight.** The advertiser respects the global AI kill switch — if a human has hit
`ai_paused` (via `aiControlPause`), the advertiser stands down with every other AI agent. Each run is
logged to the live oversight feed with `logAiAction` (agent `ppc_ad_ai`), including how many posts it
queued and which platforms it prioritized, so a human watching the AI sees the advertising in real time.

## 3. The closed loop, end to end

```
advertiser needs reach ──> premiumPPCAutoAdvertise (daily)
      │  reads adLearningInsights() ──────────────────────────┐
      ▼                                                        │
  AI writes #ad-disclosed copy (InvokeLLM, spend-capped)       │
      ▼                                                        │
  queued to consenting members (pending_approval)              │
      ▼                                                        │
  member reviews in PremiumAdQueue ── one-tap post / share / copy
      ▼                                                        │
  premiumAdDecide records outcome ──> recordAdOutcome()        │
      ▼                                                        │
  OptimizationSignal + AgentLearningMemory (agent ppc_ad_ai) ──┘
      ▼
  learningInsights / learningDistill / self-learning grounding
      ▼
  next batch: better platforms first + better copy exemplars
```

## 4. Code map

- `backend/sdk/ad-learning.ts` — `recordAdOutcome`, `adLearningInsights`, `prioritizeByLearning`, `AD_AGENT`.
- `backend/sdk/ai-control.ts` — `aiPaused`, `logAiAction`, `recordCorrection` (shared oversight/learning).
- `premiumPPCAutoAdvertise` — the daily engine (pause guard, learned targeting, exemplars, feed log).
- `premiumAdDecide` — records every member decision as a learning outcome.
- `premiumAdQueue` / `PremiumAdQueue.jsx` — the member review + one-tap post/share/copy surface.

## 5. Flagged for counsel / platform review before this runs for real

- **Platform API terms.** Auto-posting (and even queued-for-approval posting) on members' Meta / TikTok /
  X / LinkedIn accounts must comply with each platform's developer and automation terms; some require app
  review/approval before any automated posting.
- **FTC.** #ad disclosure is appended automatically; confirm placement/wording meets current guidance for
  the surfaces used.
- **Consent durability.** Confirm the clickwrap consent and revocation flow meet applicable standards; a
  member revoking consent must stop future queueing.

_The learning loop makes the ads **better**, not **cleared**. None of the above is solved by code._
