# Earn-Parity Package — Design Spec (pre-code)

Goal: close the earning gap between premium and non-premium **without fraud and without unsustainable cash
burn**. The gap is a *payout-source* problem (premium answers your own advertiser-funded AdGrid inventory;
non-premium answers third-party BitLabs at market rate), so every lever here is about **inventory, matching,
and genuine throughput** — never about answering faster (the speeder floor makes that impossible anyway).

Five components, in build order. A + B are the core you approved; C boosts them; D + E are fast-follows.

---

## A. Non-premium AdGrid access (Option 3)

**What it does:** lets non-premium users answer your own AdGrid/PPC surveys — the same high-paying inventory
premium uses — at the same per-answer rate, but only from capacity left over after premium demand is served.
When that runs out for the day, they fall back to BitLabs as today.

**How it works**
- AdGrid inventory is finite each day (it only exists because advertisers funded it). We treat it as a
  priority queue: active **premium** requests are served first; **non-premium** is served from the remainder.
- A configurable **premium reserve** holds back a slice of daily AdGrid capacity so premium is never crowded
  out even on a busy day.
- While a non-premium user is on AdGrid, they earn the AdGrid rate (advertiser-funded), capped at the same
  $8/day. When AdGrid capacity for non-premium is exhausted, they seamlessly drop to BitLabs.

**Data / knobs (new settings)**
- `ADGRID_NONPREMIUM_ENABLED` (bool, default on)
- `ADGRID_PREMIUM_RESERVE_PCT` (e.g. 0.5 — half of daily AdGrid capacity is premium-only)
- `ADGRID_NONPREMIUM_DAILY_SESSION_CAP` (max AdGrid sessions a non-premium user can pull per day)
- Reuse existing per-session/daily counters to track consumption.

**Guardrail:** premium always has priority; the reserve guarantees it. No cash subsidy here — you're only
sharing inventory you already sell, so cash risk is zero. Parity scales with how many advertisers you sign.

**Reused vs new:** reuses `surveyProviderForTier` (premium→adgrid, non-premium→bitlabs) — we change it from a
hard tier split into a *priority-with-fallback* router. New: a small capacity/priority helper in the SDK.

---

## B. Premium-slot reallocation (your idea)

**What it does:** when a premium user doesn't use their AdGrid priority on a given day, that idle high-paying
slot is handed to your best non-premium member — filling unused inventory and rewarding your top free users.

**Eligibility for a reallocated slot** (a non-premium user must clear all three):
1. **Consistent earner** — earned their full daily take-home on at least `N` of the last `M` days. Note:
   "$4/day take-home" = a non-premium user's 50% share of the $8 gross, i.e. they consistently max their cap.
2. **High engagement** — engagement score at/above `REALLOC_ENGAGEMENT_MIN` (score built from recency,
   streak, completion rate, and disqualification rate — see below).
3. **Not already granted** today.

**Daily flow (scheduled job)**
1. Find premium seats with no AdGrid activity by the cutoff time → **releasable slots** `R`.
2. Rank eligible non-premium users by (consistency, engagement) desc.
3. Grant the top `R` users a **one-day AdGrid priority pass** (an `AdGridSlotGrant` row, expires end of day).
4. Notify them: "You've unlocked premium-speed surveys today."
5. A granted user is treated at premium priority for that day; genuine premium who return late are still
   served (grants only draw from the reserve/no-show surplus, so premium is never displaced).

**Data (new)**
- `AdGridSlotGrant` entity: `{ user_id, granted_date, source, expires_at, used }`.
- `engagement_score` — computed metric (can live on the user or a daily rollup). Formula (tunable):
  `recency_weight·active_today + streak_days + completion_rate − disqualification_rate`. Start simple,
  refine later.

**Settings**
- `REALLOC_ENABLED`, `REALLOC_CUTOFF_HOUR_UTC`, `REALLOC_LOOKBACK_DAYS` (M), `REALLOC_MIN_CONSISTENT_DAYS`
  (N), `REALLOC_MIN_DAILY_TAKE_USD` (4), `REALLOC_ENGAGEMENT_MIN`.

**Guardrail:** reallocation moves *inventory*, not cash — no subsidy, no reserve draw. Premium priority is
preserved by the reserve in A.

---

## C. Voice completion for throughput (the legitimate half of your voice idea)

**What it does:** lets users answer by voice so they complete *genuine* surveys faster — more real
completions per session = more earnings, up to supply and the daily cap. Most valuable on AdGrid (the
high-paying inventory), so it stacks with A + B.

**The bright line (why this is legal and passive auto-answer is not)**
- ✅ The **user speaks their own answer**; the AI reads the question aloud (TTS), transcribes the spoken
  reply (Whisper), maps it to the a/b/c/d option (autofill matcher), shows the match, and the user
  **confirms**. The AI never decides the answer — it only reads and transcribes what the user said.
- ❌ **Not built:** the phone auto-*selecting* answers the user didn't give. That's survey fraud — providers'
  attention checks catch it, it gets your account banned, and it destroys the genuine-opinion data that
  advertisers pay for (which is what funds AdGrid in the first place). It also contradicts the integrity
  engine we just shipped.

**On the "voice speed" question you asked me to work out**
- The AI's reading/answer pace is set to **natural conversational speed** (~150–160 wpm TTS), *not* pushed
  artificially fast. Here's why fast is pointless: a genuine spoken answer to a 10-question survey lands
  around **2–4 minutes** — comfortably above the ~20-second speeder floor, so it pays. If we sped the AI up
  to shave that toward the floor, we'd start tripping speeder detection and *lose* payouts. So the target
  isn't "as fast as possible," it's "natural pace, genuine answers, above the floor." Speed was never the
  lever — throughput of *real* answers is.

**Data / reuse:** reuses `submitVerifiedSurveyResponse`, Whisper transcription, the autofill matcher, and
`AUTOFILL_MATCH_MIN_CONFIDENCE` (low-confidence maps re-ask instead of guessing). New: a voice mode on the
AdGrid/survey UI (TTS read-aloud + listen + confirm). Also an **accessibility win** — the phone reads
questions to users who can't easily read the screen, and they answer by voice.

**Consent/privacy:** voice recording needs explicit consent (already handled in the verified-survey consent
ledger). Audio is transcribed in memory and not stored, per existing policy.

---

## D. Multi-provider survey supply (fast-follow)

**What it does:** adds more survey networks alongside BitLabs (e.g. CPX Research, TheoremReach, Pollfish) so
there are more surveys available per day. Supply is the real constraint — "no surveys available" is the #1
reason survey earners stop earning — so more networks = more earning hours.

**How it works:** each provider gets an adapter behind a common interface (mirroring the BitLabs integration:
a fetch-surveys call + a postback endpoint + a reward mapping through `computeSurveyReward`). A provider
registry routes users to whichever network has matching inventory. Per-provider flags to turn networks on/off.

**Data:** a `SurveyProvider` registry (or settings-driven list); per-provider postback functions modeled on
`bitlabsPostback`.

---

## E. Screen-out credit + profiling (fast-follow)

**Screen-out credit:** when a provider disqualifies a user mid-survey, grant a small consolation credit so
wasted time still earns a little and they keep going. This is the *only* cash outflow in the whole package,
so it's **reserve-gated** through the growth engine — it never pays out money you haven't set aside.
- Settings: `SCREENOUT_CREDIT_USD` (small), `SCREENOUT_DAILY_CAP`. Track screen-outs per user.

**Profiling:** enrich each user's survey profile (demographics, interests) so they're matched to surveys they
*qualify* for. Fewer disqualifications = more completions = more earnings — a big, underrated multiplier. A
one-time profile-completion prompt plus ongoing signal capture.

---

## F. CYK master profile (the legitimate version)

**What it does:** the user fills a finite set of stable demographic/screening facts once (`SurveyProfile`
entity: age band, gender, ZIP, income band, household, employment, etc.). Used two ways, both safe:
1. Feed the **provider's own profiler** so *they* skip re-asking those questions → far fewer screen-outs.
2. **Confirmed autofill of only the screening layer** in our own PPC surveys, which the user still reviews.

**The hard wall (survey-profile.ts):** a finite `SCREENING_KEYS` whitelist. `sanitizeProfileAnswers` drops
anything not on it before saving; `confirmedAutofill` returns null for any question that isn't a tagged
screening key. So substantive survey content — the advertiser's actual research — is never stored and never
autofilled. Genuine answers stay genuine; providers' attention/consistency checks stay satisfied; advertiser
data (which funds AdGrid) stays clean.

**Functions/UI:** `saveSurveyProfile`, `getSurveyProfile`, and the `SurveyProfile` page (fill-once form with
a completeness meter). Why it matters: screen-outs are the #1 time-waster; better matching = more completes
= more earnings. It cuts wasted time — it does not touch premium per-minute rate.

## Economic safety summary

- **A, B, C** move inventory and throughput — **no cash subsidy**, so no burn risk. Parity scales with your
  advertiser revenue, honestly.
- **E's screen-out credit** is the only subsidy and it's reserve-gated (never over-promises).
- Every earning path stays inside the closed loop (non-cashable Site Cash) and inside the integrity engine
  (speeder floor, attention/consistency, genuine-answer requirement).

## G. Earn on the go (bursts) — suggestions 1–14

Non-premium takes surveys in a **burst format** by default (a UX default, `BURST_MANDATORY_NONPREMIUM`,
which does NOT lock anyone out). The daily goal is worked in short, resumable bursts.

- **burst.ts** — config + `computeBurstStatus` (progress vs goal) + `shortestFirst` (quick-hit surveys) +
  `nextBurstDecision`: goal reached → shortest BitLabs survey → **AdGrid top-up** (when BitLabs is dry, via
  the built adgrid-access) → other enabled provider → nothing-right-now. Each burst is ONE straight-through
  unit + a break; pausing never happens mid-survey (integrity engine).
- **Functions:** `burstNext` (next unit, passing the client's available surveys), `burstDayStatus` (progress
  bar), `burstComplete` (advance the counter, cross-device sync), `setBurstPace` (one-at-a-time / timed
  sprint / count). **BurstSession** entity holds per-day state.
- **Frontend:** `BurstMode.jsx` (progress bar, pace picker, one-survey bursts, timed sprint, break timer,
  AdGrid top-up, offline handling), `EarnOnTheGo` page, `offlineQueue.js` (IndexedDB queue that flushes on
  reconnect — answers still pass timing/attention checks on flush).
- **Reaches $8 by** stacking on the built inventory levers: BitLabs bursts → AdGrid top-up (A) → CPX (D),
  with screen-out credit (E) and profile matching (F) making each burst more productive, and reallocation
  (B) handing consistent earners premium-speed inventory.

**Requirement note (suggestions 15–18, NOT yet built):** the burst *format* is the non-premium default; the
$8/day *outcome* is deliberately NOT a hard lockout gate here, pending the "hard gate vs required-effort +
funded-path" decision. Nothing in this code blocks a user from the site.

## Compliance guardrails (unchanged, restated)

- No passive/auto-answer, no gaze auto-selection — genuine human answers only.
- Voice = the user answers; the AI reads and transcribes, never decides.
- Camera/eye-tracking not built (biometric-consent law + it doesn't raise payout anyway).
- Site Cash stays non-withdrawable, closed-loop.

## Build order

1. **A** — non-premium AdGrid access with premium reserve + fallback.
2. **B** — reallocation job + `AdGridSlotGrant` + engagement score.
3. **C** — voice completion mode (reusing the verified-survey pipeline).
4. **D** — second survey provider (proves the multi-provider interface).
5. **E** — screen-out credit (reserve-gated) + profile enrichment.

Open decisions to confirm before coding: the reserve % for premium (A), the reallocation thresholds
(N-of-M days, engagement minimum, cutoff hour), and whether to start D with one specific extra provider.
