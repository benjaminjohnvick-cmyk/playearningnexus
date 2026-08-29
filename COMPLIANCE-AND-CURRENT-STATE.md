# Compliance & Current State

**Prepared: July 28, 2026. Updated: July 29, 2026 (GamerGain 8).** A statement of how GamerGain /
PlayEarning Nexus works today and its posture on the issues that can be addressed in code. It is not legal
advice; have counsel review it against your jurisdictions before launch.

---

## Update 2026-07-29 — Premium PPC up-front model, AI advertising, and compliance backstops

Since the July 28 statement, the Premium PPC network changed materially and three default-safe code
backstops were added. Read this alongside the July 28 body below.

**New Premium PPC model (up-front points grant).** Matched survey-members now receive the full year's
value — **$1,460 as 146,000 closed-loop, non-cashable points** — **up front**, in exchange for a ~8-min/day
survey commitment for a year. **Nothing is repaid or clawed back.** The only consequence of falling behind
is a pause of PPC surveys (the member keeps all points; re-enrollment uses in-app lockout mode). This is a
toggle (`PREMIUM_UPFRONT_GRANT`, default on) over the older earn-as-you-go path. Structurally it is
designed to be **neither consumer credit nor a security** (no money advanced/collected, no repayment) and
to **stay out of money transmission** (closed-loop, non-cashable). **Counsel must confirm** the up-front
characterization, the real-dollar advertising with the points-at-1¢ disclaimer, and 1099 tax treatment.

**AI social advertising on consenting members' accounts.** The AI writes `#ad`-disclosed ads for paying
advertisers (free until they've doubled their spend) and a daily own-business post, queued to members who
**OAuth-connected** accounts and **consented** at enrollment. Posts **default to member approval**
(`PREMIUM_ADS_REQUIRE_APPROVAL`), never silent auto-posting; the master `social_posting` flag and the
global `ai_paused` switch both halt it. The ad engine **learns** from member post/skip decisions through
the platform's existing learning primitives (`OptimizationSignal` / `AgentLearningMemory`, agent
`ppc_ad_ai`). **Counsel/platform review required** before this runs for real: each platform's API/
automation terms (Meta/TikTok/X/LinkedIn) and FTC #ad adequacy.

**Compliance backstops (default-safe; no user-facing change unless an admin sets them).**
- `DAILY_EARN_CAP_USD` now enforced on the main PPC earning path (`processPPCSession` clamps earnings and
  records `DailyEarnings` so the cap accumulates across all earning paths). Default 0 = no cap.
- Payout reservations are released on `failed`/`cancelled` (previously only `rejected`), so funds that
  never left are returned to a user's available balance.
- `awardReferralJackpotEntries` now applies the jurisdiction + 18+ age gate at **entry**, mirroring the
  jackpot **payout** gate (`processWeeklyJackpot`).
- Confirmed already-wired: `AI_DAILY_SPEND_CAP_USD` (enforced in `InvokeLLM`) and `MAINTENANCE_MODE`
  (enforced in the server request path).

---

## 1. The product in one paragraph
A play-to-earn web and mobile platform. Members complete surveys, offers, and activities to earn
**points**, a closed-loop unit worth one cent of the local currency for in-Service pricing. Points are
spent inside the Service — in a store and a Facebook-Marketplace-style marketplace. Real-money cash-out
is not enabled; card charging is off by default. An AI system generates an original product catalog,
localizes the Service to the user's country, personalizes the experience, and improves the Service over
time under human guardrails.

## 2. Money model and why it is lower-risk
- **Closed loop.** Points are earned and spent inside the Service and are not cashable, so the platform
  does not, in its default posture, transmit money to users. This is enforced in code (cash-out is a
  gated feature, off by default), not merely by policy.
- **Local-currency pricing.** Points equal one cent of the user's local currency for pricing; the
  amounts users see are converted per country.
- **Card charging off by default.** When enabled, card payments run through a third-party processor and
  a disclosed markup applies. Orders paid by card are not fulfilled and funds are not released until
  payment is captured, so nothing ships or pays out unpaid.
- **Guarded settings.** Money- and compliance-sensitive values (minimum age, tax thresholds, caps,
  points cashability, affiliate structure) sit behind hard bounds and are excluded from automated
  optimization.

## 3. Age and minors
Minimum age is **18**, enforced as a hard floor in code. The Service is not directed to children and
does not knowingly collect data from anyone under 18.

## 4. Marketplace and the AI catalog — the intellectual-property posture
- **Original content only.** The platform catalog is generated as **original** products — original
  titles, descriptions, and AI-generated images. No retailer's listings, images, or descriptions are
  copied or scraped.
- **Real branded goods only through authorized channels.** Real products enter only through a retailer's
  **official affiliate API/links**, and only when you have supplied your own authorized credentials for
  that program; such links are disclosed per advertising rules.
- **"Find the real thing" search.** Sends the shopper to genuine third-party search results (affiliate
  when configured, neutral shopping search otherwise). It does not present an AI image as a specific
  branded product for sale by us.
- **Member listings.** Users may list or relist their own items; relisting exposes no personal
  information. Prohibited and regulated items are blocked.
- **Fulfillment.** Platform items use an AI-managed order process; member items are shipped by the
  seller through an AI-managed escrow/release flow.

## 5. Advertising, affiliate, and disclosure
Affiliate links are labeled and disclosed. Any influencer or promotional content should carry the
configured disclosure tag. Marketing email respects frequency caps and includes required sender
information; SMS marketing is off by default until consent and carrier requirements are met.

**Two-tier referral bonus + paid-endorser program (BUILT, gated OFF pending counsel).** Two Site Cash reward
features ship disabled by default and move no money until enabled after sign-off. (a) A single-tier referral
bonus: **$5** per active referred user and **$2,000 per referred paying advertiser on each of the three tiers**
(`REFERRAL_TIERS_ENABLED=0`), the advertiser bonus paid only after the referred advertiser's payment clears + a
45-day clawback, never on refund/chargeback/self/no-KYC. (b) A paid-endorser program: opted-in members earn a
share (default 20%, capped daily/period) of the **measured** conversion value their **#ad-disclosed** posts
drive; the AI personalizes an advertiser's **approved** copy (no income claims, disclosure enforced), posts as a
human-approved **draft** by default (auto-posting triple-gated), and self-improves on conversion data
(`ENDORSER_ENABLED=0`). Both are single-tier (no downline), all Site Cash (non-cashable, closed-loop), 1099
default-reportable, and fully audited. Full posture + counsel questions: `SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md`.

## 6. Data protection and user rights
- **What is collected:** account data, transaction data, behavioral/interaction data (including
  survey-answer timing used for quality and fraud checks), device data, and approximate location from IP
  (to set country, currency, language, and flag).
- **Controls in the product:** opt out of behavioral recording, download your data (behavioral, AI
  profile, and marketplace data included), and delete your account (profile anonymized, behavioral data
  erased subject to legally required retention).
- **AI transparency:** automated systems personalize and operate the Service; material money/compliance
  decisions stay under human oversight.
- See the Privacy Policy for the full statement.

## 7. Tax
Where earnings become reportable (for example if cash-out is later enabled), tax-information collection
and reporting thresholds and any backup-withholding rate are configured in guarded settings and should
be finalized with a tax advisor for each jurisdiction.

## 8. Intellectual-property complaints (DMCA-style)
The Service supports notice-and-takedown handling and counter-notices, with a designated agent contact
to be set before launch.

## 9. Internationalization and jurisdiction
The Service localizes currency, language, and country presentation across many markets and detects the
user's country by IP. Feature availability, prize promotions, and money features may be restricted per
jurisdiction; those restrictions must be confirmed with counsel for each market you launch in.

## 10. What still requires human/legal sign-off (not codeable)
- Governing law, venue, and dispute terms in the Terms of Service.
- Jurisdiction-by-jurisdiction review of the points model, any future cash-out, and any
  sweepstakes/contest mechanics (registration/bonding where applicable).
- Money-transmission and payment-processor onboarding before card charging or cash-out is enabled.
- Tax registration and reporting setup.
- Final privacy review against GDPR/UK GDPR/CCPA-CPRA and regional laws, and appointment of any required
  representatives or DPO.

## 11. Guardrails that stay on
Age 18+ floor; points non-cashable until deliberately enabled; card charging off until a processor and
legal are ready; prohibited-item blocking in the marketplace; compliance keys excluded from AI
optimization; disclosed affiliate links; behavioral-recording opt-out, data export, and account
deletion available to every user.

<!-- last synced to remote: 2026-07-29 (GamerGain 9) -->
