# Assumptions Reviewed & Corrected — Profitability, Legality, Ethics, Best Practice

You asked me to revisit the assumptions I baked in and correct the ones that don't hold up. Here is every material assumption, the problem with it, and the change I made. Corrections are implemented in code unless marked **Flag** (needs your/your lawyer's decision).

## 1. "Mandatory" weekly survey & referral posting  → changed to OPT-IN
- **Problem.** Forcing users to complete surveys or post ads to their personal accounts — and penalizing them (lockouts, charging missed days) — risks unfair/deceptive-practice claims (FTC Act, state consumer law), and is coercive.
- **Profitability.** Coercion drives churn, complaints, chargebacks, and app-store/pay-processor scrutiny; voluntary + well-incentivized participation retains users and performs better.
- **Corrected.** `is_mandatory` now defaults **false** on `FeatureVoteSurvey` and `WeeklyReferralCampaign`; generators set it false; UI/notification copy changed from "required" to "optional challenge." Incentives (the $0.10, streaks, leaderboards) stay; penalties don't.

## 2. Auto-posting to users' social accounts  → only with explicit consent
- **Problem.** Automatically posting to a user's personal Twitter/Instagram/etc. is against those platforms' Terms of Service unless done through authorized OAuth with the user's opt-in, and mass-identical posts trigger spam / "inauthentic behavior" bans.
- **Legality/best practice.** Platform ToS + CAN-SPAM; risks the user's account **and** your API access.
- **Corrected.** The new daily automation (`autoReferralContestDaily`) auto-posts **only** for users with an active OAuth `SocialMediaConnection`, `auto_posting_enabled`, and an accepted agreement (`accepted_ula`) — mirroring your existing `autoSocialPostingAndTracking` — and respects the 12-hour rate limit and per-user unique copy. Everyone else gets an **optional reminder**; nothing is posted on their behalf.

## 3. Referral/affiliate posts without disclosure  → FTC disclosure enforced
- **Problem.** Paid/incentivized endorsements must disclose the material connection (FTC Endorsement Guides). Undisclosed affiliate posts are illegal.
- **Corrected.** `WeeklyReferralCampaign` now carries `requires_disclosure` (true) and `disclosure_text` ("#ad"); auto-posts pass the disclosure through; UI reminds users to include #ad.

## 4. "$0.10 held pending until next survey"  → fair, never forfeited
- **Problem.** Indefinitely withholding money a user already earned, contingent on more labor, can be an unfair practice.
- **Corrected.** Kept the "credited on next survey" incentive, but added a **grace-period sweep** (`creditPendingReferralPostRewards` with `grace_days`, run daily) that auto-credits rewards pending longer than 30 days regardless. Earned money is always eventually paid.

## 5. "Miss a week → doubled posting requirement"  → positive nudge, not a penalty
- **Problem.** Forcing extra labor as punishment is coercive.
- **Corrected.** Reframed as an **optional double bonus** on the user's best-performing platform (still data-driven from `UserPlatformStats`); it is never required and nothing is penalized. Copy updated.

## 6. AI auto-creating games / features / services  → human + legal review gate (already in place, reaffirmed)
- **Problem.** AI-generated games can infringe third-party IP; AI-generated "services" may be regulated (e.g., anything financial). Auto-shipping is risky.
- **Best practice.** The ecosystem engine **generates specs and queues**; anything in `human_review_categories` (payments, auth, payouts, security) always requires human approval, and IP/quality review should precede publishing any generated game/service.

## 7. Gambling (random jackpot) → skill-based tournament
- **Problem.** `processWeeklyJackpot` chose a winner by **weighted random draw** (`Math.random()`) — a lottery/raffle. Random prize + (any) consideration = gambling, which is heavily regulated/often illegal without a license.
- **Corrected — now a skill-based tournament with an entry fee and a prize pool:**
  - Winner selection rewritten to **rank participants by performance score** (referral points earned) and split the prize pool among the **top finishers** (50/30/20 for top 3). **All randomness removed.**
  - **Entry fee → prize pool:** new `enterSkillTournament` function charges an optional entry fee (from balance) that funds the pool; `prize_pool = platform contribution + collected entry fees`.
  - `ReferralJackpot` entity reframed with `is_skill_based`, `ranking_metric`, `entry_fee`, `prize_pool`, `payout_places`, and a `winners[]` results array. (Entity name kept for compatibility across 54 files.)
  - UI de-gambled: "Win Chance %" and "Your Chances" → "Point Share" / "Ranked By: Skill"; "Active Jackpot" → "Active Skill Tournament"; copy now says winners are decided by skill, not luck.
- **Note.** Skill-based contests with entry fees are legal in most places under the "skill" exemption, but a few U.S. states still restrict them and treat some as gambling. Publish official rules and have counsel confirm eligibility by state before charging entry fees. (Added to flags below.)

### 7a. Refined into an OPEN, MERIT-BASED, self-funding referral reward
Per your point — rewarding people for the referrals they actually drive is a **performance program, not gambling**: everyone gets the same open opportunity, and results track ability. Implemented so it is ethical, legal, **and** margin-accretive:
- **Open to all, no barrier.** Every user earns from their own referrals with no entry fee required (`open_to_all: true`; the optional entry fee defaults to 0 and only feeds an optional competitive top-up).
- **Paid by results, proportional to contribution.** 70% of the pool is distributed **proportionally to each participant's verified contribution** (everyone who drives real referrals earns a share); 30% is a **top-3 bonus** for the leaders. No chance anywhere.
- **Quality-gated (anti-fraud).** Only **verified, converting** referrals count — raw sign-ups that don't convert earn nothing, so you never pay for fake/low-value signups.
- **Self-funding → adds to the bottom line.** The pool is a **share (default 40%) of the actual revenue those referrals generated**; the platform keeps the remaining ~60% as margin. You only ever pay out a fraction of money the program already brought in, so it is structurally net-positive rather than "giving away 10% of profits."
- **Legally, this is standard performance/affiliate marketing** (commission for driving real customers) — not a contest of chance. Keep clear public terms and honor the affiliate/FTC disclosure rules already added.

## Flags — decisions that need you (not code I should silently change)
- **Multi-level referral commissions (MLM).** Your app already has an MLM structure. Reward programs that pay primarily for *recruitment* rather than real product value can cross into illegal pyramid-scheme territory (FTC). **Have counsel confirm** commissions are tied to genuine sales/usage, with clear earnings disclosures. I did not alter the MLM logic.
- **Paying for reviews/votes.** Paying users to post or to vote can bias outcomes and, for reviews, may violate FTC rules on incentivized reviews. Keep it to *feedback/feature preference*, disclose incentives, and don't pay for public product reviews without disclosure.
- **Data privacy.** Collecting demographics (`RespondentProfile`), external company survey data, and "all available data" for AI must comply with GDPR/CCPA: consent, purpose limitation, opt-out, and honoring the survey providers' (e.g., BitLabs) terms. Add a privacy policy + consent capture if not already present.
- **Sweepstakes/contest law.** "Contests" with prizes can trigger sweepstakes regulations (no purchase necessary, official rules, eligibility, tax reporting for winners). Publish official rules for the referral/feature contests.
- **Earnings/withdrawal & tax.** Paying users cash implies 1099 reporting thresholds and money-transmission considerations — confirm your payout provider setup covers these.
- **Shared wallet groups / money pooling.** Letting users pool funds and transfer to each other can trigger **money-transmitter / escrow / stored-value** licensing (state MTL, FinCEN, and equivalents abroad). To reduce risk, the shared-wallet feature I built moves **closed-loop platform credits** (redeemable on-platform), not external cash — closed-loop stored value is generally lower-risk than open money transmission. Before allowing real cash contributions, cash-out of pooled funds, or transfers that function like remittance, have counsel confirm licensing, add group terms, KYC where required, and contribution/withdrawal limits. Group spend is owner-approved and capped by the pool balance by design.

## What I changed in code this round
- `base44/entities/WeeklyReferralCampaign.jsonc` — `is_mandatory` default false; added `requires_disclosure`, `disclosure_text`.
- `base44/entities/FeatureVoteSurvey.jsonc` — `is_mandatory` default false.
- `base44/functions/generateWeeklyReferralCampaign/entry.ts` — opt-in + disclosure; non-coercive copy.
- `base44/functions/generateWeeklyFeatureVoteSurvey/entry.ts` — opt-in; non-coercive copy.
- `base44/functions/creditPendingReferralPostRewards/entry.ts` — added grace-period fair-crediting across users.
- `base44/functions/autoReferralContestDaily/entry.ts` — **NEW** daily end-to-end automation with all guardrails.
- `base44/agents/weekly_referral_campaign_agent.jsonc` — now daily + compliance rules.
- `src/pages/WeeklyReferralContest.jsx`, `src/pages/WeeklyFeatureVote.jsx` — opt-in + #ad disclosure copy.
