# Software Patent — Filing Strategy Memo

*Prepared 2026-09-05 for the owner and patent counsel. A plain-English strategy note to accompany the
`PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md`. **Not legal advice** — I am not a patent attorney; whether
to file, what to claim, and how to draft are decisions for a registered patent practitioner. This memo frames
the options so that conversation is faster.*

## Short answer

You don't patent "a website" or "an app" as one thing. What is protectable is the **novel functional
inventions inside it** — specific systems and methods — usually as one or more **utility patents**, plus
optionally **design patents** for the ornamental look of the UI/logo. So the realistic plan is: **protect the
individual items** (the candidate inventions listed in the disclosure brief), not "the site" as a monolith.
Whether any given item is actually patentable turns on **novelty and non-obviousness**, which only a
**prior-art search** can answer — that is the first real step, and it is counsel's to run.

## The three vehicles, in plain terms

| Vehicle | What it protects | Cost/time (rough) | Fit here |
|---|---|---|---|
| **Provisional utility application** | A 12-month, low-cost placeholder that establishes a **priority date** and lets you say **"patent pending."** Not examined; never becomes a patent by itself. | ~$130–$300 USPTO (micro/small entity) + counsel; days–weeks | **Strong first move** — cheap, fast, and it locks your date before launch. |
| **Non-provisional utility patent** | The real, examined patent on a **process/system** (e.g., "a method for graduating an automated process from human review to autonomy based on trust signals…"). | ~$8k–$20k+ per application with counsel; 2–4 years | The end goal for the **strongest 2–4 candidates**. |
| **Design patent** | The **ornamental appearance** of a screen/icon/logo (not how it works). | ~$2k–$4k with counsel; ~1–2 years | Optional — could cover distinctive UI screens or the app icon. |

## Recommended path (for counsel to confirm)

1. **Clearance / prior-art search first.** Counsel (or a search firm) checks whether the candidate inventions
   are already claimed by others. This decides which items are worth pursuing and shapes the claims.
2. **File one (or a few) provisional application(s) now — before public launch.** A provisional is cheap,
   establishes priority, and gives you "patent pending." Given the platform is pre-launch, this is the
   time-sensitive step (see the timing bar below). A single provisional can bundle several inventions, or you
   can file a handful of focused ones — counsel's call.
3. **Within the 12-month window, convert the winners to non-provisional utility patents.** Pick the 2–4
   strongest, most defensible, most commercially central inventions (the disclosure brief's Section 1 is the
   short list). You do **not** need to patent all ~983 functions — most are ordinary implementation; patents
   target the **novel mechanisms**.
4. **Consider a design patent** for the app icon / a signature screen if the look is distinctive and worth
   defending.
5. **International:** if non-US markets matter, a **PCT application** within 12 months of the earliest filing
   preserves foreign rights. Discuss cost vs. target markets with counsel.

## Timing bar — why "before launch" matters

In the US, your own **public disclosure, sale, or public use** starts a **one-year clock** to file, and in
**most other countries there is no grace period at all** — a public launch can immediately bar foreign patents.
Because this platform is heading to launch, the safe sequence is **file at least a provisional before the app
is public / offered for sale.** This is the single most time-sensitive item in this memo.

## Which "individual items" are the candidates

From `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md` (Section 1), ranked by how distinctive and central they
look — **counsel and the prior-art search set the final priority:**

| # | Candidate invention | Suggested vehicle | Why it's a candidate |
|---|---|---|---|
| 1 | **Graduated-autonomy trust kernel** (earned-vs-permanent-gate, pure trust math) | Non-provisional | A general engine, not a one-off; concrete, technical, testable. |
| 2 | **Dollar-budget-derived auto-scaling governor** with burst + hysteresis | Non-provisional | Deriving replica count from a $ budget + self-reverting burst is a specific technical method. |
| 3 | **Retention-weighted PMF scoreboard + agent** (shrinkage-adjusted retention, human-gated actions) | Non-provisional | A specific scoring + action method. |
| 4 | **Self-learning optimizer** (consent-first A/B → auto-apply-when-live → auto-revert) | Non-provisional / provisional | The closed measure→apply→revert loop with a go-live gate is a concrete process. |
| 5 | **Closed-loop non-cashable value economy** (two-sided ledger split) | Provisional first (Alice risk) | Novel architecture, but "economic" claims draw abstract-idea scrutiny — technical framing needed. |
| 6 | **Structurally-bounded first-party data collection** (manifest + write-time hard guard) | Provisional | A specific data-governance mechanism. |
| 7 | **Tiered device-offload** of compute/hosting with server re-validation | Provisional | Technical cost-scaling method. |
| 8–15 | The remaining Section-1 items (delivery-guarantee/make-good, price-held ratio-climb monetization, revenue-levers registry, milestone-anchored term engine, attention-rewards extension, AI order fulfillment, cost-floor command) | Provisional bundle | Weaker or more business-method-flavored — bundle into a provisional and let counsel test them. |

## Honest caveats

- **Patentability is not guaranteed.** Software/business-method claims face the *Alice* "abstract idea" test;
  the more an invention is tied to a **specific technical implementation and improvement** (as several of these
  are), the better it survives. A prior-art search may also find blocking art.
- **Cost and time are real.** Each non-provisional is meaningful money and 2–4 years. Provisionals are the
  cheap way to buy a year of optionality and priority.
- **A patent is a disclosure.** Filing publishes how the invention works (after ~18 months). For a few
  mechanisms, **trade-secret** protection (keep it confidential) may be the better play — counsel weighs
  patent-vs-secret per item.
- **This memo is strategy, not a legal opinion.** The go/no-go, the claim scope, and the drafting are counsel's.

## What to hand your patent attorney

1. `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md` — the 100% inventory + the Section-1 candidate write-ups.
2. This memo (the filing-strategy frame).
3. Access to the code (the disclosure brief cross-references every engine/function by name).
4. Your launch timeline — so counsel can file provisional(s) **before** public disclosure.

*Cross-references: `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md`, `PATENT-GROUNDWORK-AND-INVENTION-DISCLOSURE.md`,
`FOR-YOUR-ATTORNEY.md`.*
