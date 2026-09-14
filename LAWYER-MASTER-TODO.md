# Master Legal To-Do & Deliverables List

> **⚠️ NOT LEGAL ADVICE.** An inventor-prepared, exhaustive master checklist of every legal, tax, and compliance
> action a licensed attorney (and, where marked **(CPA)**, a tax advisor) should take across **100% of the
> platform** — **Get Goods Gratis (Free)**, an 18+ closed-loop retail / e-commerce rewards marketplace
> (website / PWA + iOS / Android). It consolidates **every counsel suggestion already raised anywhere in this
> packet** and adds a full set of items I recommend that the packet did not yet call out (each of those marked
> **(added)**). Items counsel should **draft or produce** as a work-product are gathered in Part B.
>
> **Governing rule for the entire site:** *nothing money-, credit-, minor-, chance-, biometric-, or
> auto-charge-related goes live until counsel clears its named switch.* Every risky capability already ships
> **OFF** behind a feature flag and/or a `*_LEGAL_SIGNOFF` boolean; this list is the map of what to clear.
> Prepared 2026-09-14. This master supersedes `LAWYER-TODO-FULL-SITE`.

**Legend:** `- [ ]` an open action · **(added)** = my recommendation, not previously in the packet ·
**(CPA)** = needs the tax advisor · **(switch)** = gated by a named admin flag · **→ `DOC`** = the packet doc
that supports the item · sections map 1:1 to the packet's category folders.

---

## Part A — Review, confirm & approve (existing surfaces)

### 0. Foundational — do first (most items below depend on these)

- [ ] **Form the legal entity** (LLC / S-corp / C-corp) with owner + CPA; flow the chosen name into every
  `[LICENSOR]` blank (ToS, EULA, Advertiser Contract, Partner Agreement, patent + trademark assignments).
- [ ] **EIN, registered agent, operating agreement / bylaws, organizational resolutions.** (added)
- [ ] **Founder & contractor IP assignment** — signed assignment of all pre-formation IP (code, brand, patent,
  content) into the entity before any filing or fundraising. (added)
- [ ] **FinCEN Beneficial Ownership Information (BOI)** report, and state business / seller's-permit licenses. (added)
- [ ] **Governing law + venue + arbitration vs. courts + class-action waiver** — identical across ToS, EULA,
  Advertiser Contract, Partner Agreement.
- [ ] **Document precedence:** app-store terms > EULA > ToS > publisher EULA > AUP.
- [ ] **NDA posture** — mutual NDA before sharing trade-secret patent material with any un-retained firm
  (provisional §13). → `COUNSEL-ENGAGEMENT-START-HERE` §6
- [ ] **Fill the blanks** — `BUSINESS_MAILING_ADDRESS`, `DMCA_AGENT_EMAIL`, legal / privacy / accessibility /
  support contacts, `TERMS_VERSION`, effective dates. → `FOR-YOUR-ATTORNEY` §14
- [ ] **Insurance program** — cyber / data-breach, technology E&O, media & advertising liability, general
  liability, and **(added)** D&O and EPLI (if hiring). Bind before launch.

### 1. Consumer terms & policies  → folder `Consumer Terms & Policies`

- [ ] **Terms of Service** — review, tailor, approve. → `TERMS-OF-SERVICE`
- [ ] **EULA** — app-software license incl. Apple LEULA minimum terms + Google Play. → `END-USER-LICENSE-AGREEMENT`
- [ ] **Privacy Policy** + **Cookie & Tracking Notice** + app-store privacy labels. → `PRIVACY-POLICY`, `COOKIE-AND-TRACKING-NOTICE`
- [ ] **Refund Policy.** → `REFUND-POLICY`
- [ ] **Acceptable Use Policy** — prohibited conduct/content, enforcement, CSAM/NCMEC, appeals. → `ACCEPTABLE-USE-POLICY`
- [ ] **Accessibility Statement** — ADA Title III / WCAG 2.1 AA target + markets, feedback SLA. → `ACCESSIBILITY-STATEMENT-AND-BRIEF`
- [ ] **Marketplace / seller terms** for third-party goods. → `MARKETPLACE-SELLER-TERMS`
- [ ] **Clickwrap enforceability** — confirm the consent-capture (timestamp + version to the consent ledger)
  forms a binding agreement in each launch jurisdiction. (added)
- [ ] **Community Guidelines** as a public, plain-language companion to the AUP. (added) → Part B

### 2. Privacy & data  → folder `Privacy & Data`

- [ ] **Lawful basis** per data category and market. → `DATA-COLLECTION-BRIEF-FOR-COUNSEL`
- [ ] **Founding "collect everything" first-party posture** — adequately disclosed / consented (feeds the AI model).
- [ ] **Sensitive data** — TIN security; **voice recording** two-party / wiretap consent + Illinois **BIPA**
  (and TX CUBI / WA); **DOB / age-assurance** beyond self-attestation given the social & voice features.
- [ ] **DPIA / DPA package** — DPIA for profiling + AI + session screenshots; formal **RoPA**; **sub-processor
  DPAs** + maintained list; **international transfer** mechanism (SCCs / UK IDTA) + **EU/UK Art. 27 reps**;
  **DSAR** SLAs; **retention schedule** by category; **"do not sell / share"** adequacy; **breach-notification
  plan**. → `DATA-COLLECTION-BRIEF-FOR-COUNSEL`
- [ ] **Session-replay / screenshot sampling** disclosure vs. CIPA / two-party wiretap; ships OFF **(switch** `session_screenshots`**)**.
- [ ] **Data-broker registration** (CA / TX / OR / VT) — confirm whether the model / data practices trigger it. (added)
- [ ] **Global Privacy Control (GPC)** honoring + universal opt-out signals. (added)
- [ ] **Biometric written policy + retention/destruction schedule + standalone consent** before any voiceprint
  or face data is processed. (added) → Part B
- [ ] **COPPA / incidental-minor handling** even with the 18+ floor — deletion path if a minor is discovered. (added)

### 3. The closed-loop money model, payments & tax  → folder `Money, Payments & Tax`

- [ ] Confirm **non-cashable, closed-loop Site Cash** stays outside **money-transmission / stored-value** law in
  each target state. **(switch** `cash_out`, `CASH_OUT_LEGAL_SIGNOFF` **default ON)** → `FOR-YOUR-ATTORNEY` §1
- [ ] Confirm **business-only cash-out** (real money only to advertisers/partners) reads as ordinary vendor
  payments, not money transmission; confirm the **partner-classification list**.
- [ ] **Treasury / solvency reserve** adequacy vs. stored-value / segregation rules. → `TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT`
- [ ] **Payments / merchant** — underwriting with delayed-fulfillment risk disclosed; PCI SAQ-A; payout-rail
  (PayPal / Venmo / Cash App) terms; SCA / 3-D Secure. → `PAYMENTS-ARCHITECTURE-AND-MERCHANT-BRIEF`
- [ ] **Credit products (all OFF)** — decide whether to unlock **Flexible Payment Terms**, **Tier 1 Pay-From-
  Results**, **Goods Advance**, and by which licensed path; disclosures + licensing. **(switch** each `*_LEGAL_SIGNOFF`**)** → `FOR-YOUR-ATTORNEY` §2, `FLEXIBLE-PAYMENT-TERMS-COMPLIANCE`, `TIER1-FINANCED-PAY-FROM-EARNINGS`
- [ ] **Unclaimed-property / escheatment** analysis on dormant Site Cash balances and refund credits. (added)
- [ ] **OFAC / sanctions screening** + basic AML/KYC on advertisers and paid sellers. (added)
- [ ] **(CPA) Marketplace-facilitator characterization** — facilitator vs. reseller/conduit vs. retailer of record.
- [ ] **(CPA) Sales-tax nexus + registration plan + tax-calc engine**; **product-taxability map** (goods vs.
  software vs. games) by state.
- [ ] **(CPA) VAT / GST** cross-border scope (OSS / IOSS); whether to geo-restrict digital sales at launch.
- [ ] **(CPA) 1099** — $600 threshold + 24% backup withholding; filing provider; state filing / TIN-matching;
  **1099-K** interplay per payout rail; TIN security at scale. **(switch** `TAX_1099_THRESHOLD`, `TAX_BACKUP_WITHHOLDING_RATE`**)** → `TAX-OBLIGATIONS-AND-FILINGS-BRIEF`, `TAX-1099-PIPELINE`
- [ ] **(CPA) Entity income-tax** filings + estimated payments; **revenue recognition** on prepaid advertising
  (unearned revenue over the term); **tax-reserve** cadence. → `TAX-OBLIGATIONS-AND-FILINGS-BRIEF`
- [ ] **(CPA) Sales tax on advertising services** by jurisdiction.

### 4. Advertising, tiers & the founding offer  → folder `Advertising, Tiers & Founding Offer`

- [ ] **Advertiser Contract** (formal signable) + **Advertiser Terms** — review / finalize. → `Advertiser Contract\ADVERTISER-CONTRACT`, `Agreements\ADVERTISER-TERMS-AND-AGREEMENT`
- [ ] **Prepaid 52-week / 13-cycle billing** — confirm **no auto-renew / negative-option** on the paid path; the
  "13 four-week cycles" (not "monthly") disclosure; SCA. → `FOR-YOUR-ATTORNEY` §13b
- [ ] **30-day proportional cancellation** — the one-third refund math, clear-and-conspicuous non-refundable
  disclosure, and closed-loop **credit-not-cash** treatment. → `ADVERTISER-BILLING-CANCELLATION-AND-SITE-CASH`
- [ ] **Full-Value / delivery guarantee + make-good** — value delivered, **never ROI**; make-good bounded by
  volume + time. **(switch** `FULL_VALUE_GUARANTEE_ENABLED`, `DELIVERY_GUARANTEE_*`**)** → `FULL-VALUE-DELIVERY-GUARANTEE`, `DELIVERY-GUARANTEE-MAKEGOOD`
- [ ] **Value-stack claims** — Tier 1 "$13k → ~$26k advertising value," Tier 2 "$200k → ~$400k," Tier 3
  uncapped — substantiated by conventional rate-card values, no implied revenue/ROI. → `TIER1-VALUE-STACK`, `TIER2-VALUE-STACK`, `TIER3-UNLIMITED-SPEC`
- [ ] **Tier 2 multi-year continuation / auto-renewal** — advance notice, cancel window, recurring-charge
  disclosure vs. state ARL + FTC negative-option; results-gated exit + up-front consent. → `FOR-YOUR-ATTORNEY` §8
- [ ] **Tier 2 upfront deposits** — unearned-revenue treatment, make-good/refund, large-prepayment rules. → `TIER2-DEPOSITS`
- [ ] **Two-tier price** (+30% at close), grandfathering, "return of capital" optics on the founding discount. → `FOR-YOUR-ATTORNEY` §7
- [ ] **Pricing / boost optics** — the $2,000 boost decoupled from purchase (not a rebate, not "cash," not "free"). → `PREMIUM-BOOST-ADVERTISING`, `PREMIUM-GIFT-BOOST`
- [ ] **Ad media, targeting & PPC surfaces** — consumer-protection review of ad formats, targeting, interstitials. → `AD-MEDIA-AND-TARGETING-DESIGN`, `PPC-ADVERTISER-SURVEYS-AND-INTERSTITIAL`
- [ ] **Affiliate postback / attribution** integrity and disclosure. → `AFFILIATE-POSTBACK-INTEGRATION-SPEC`

#### 4a. The founding offer (highest-variance area)  → same folder / `Founding Offer`

- [ ] **Securities / Howey** — the 100%-for-life survey earn-share posture. → `FOUNDING-OFFER-COUNSEL-REVIEW` §3a
- [ ] **Crowdfunding / pre-sale + two-phase use-of-funds** — Phase 1 business-expenses-only restriction vs.
  escrow / custodial treatment; reserve-to-deliver; non-refundable presale disclosure. → `FOUNDING-OFFER-COUNSEL-REVIEW` §3d/§3f
- [ ] **Free-trial → auto-conversion (negative option)** — **business-vs-consumer** status under ROSCA + state
  ARLs; whether the six safeguards satisfy ROSCA + the FTC Negative-Option / click-to-cancel Rule + state ARLs
  (esp. CA); disclosure / consent / reminder / cancel / refund design; **sign-off before enabling**
  **(switch** `FOUNDING_FREE_TRIAL_*` **default OFF)**. → `FOUNDING-OFFER-COUNSEL-REVIEW` §3g
- [ ] **Money-transmission / stored-value** on the $2,000 grant + proceeds. → `FOUNDING-OFFER-COUNSEL-REVIEW` §3e
- [ ] **No-fill-deadline / benefit-year-at-milestone** mechanics + their flags. → `FOUNDING-OFFER-DESIGN-AND-BUILD`

### 5. Earning, rewards, referrals & FTC  → folder `Earning, Rewards & FTC`

- [ ] **No forward earnings promises** — results hypothetical-until-substantiated; FTC-aligned copy. **(switch** `earnings_projections` OFF**)** → `FOR-YOUR-ATTORNEY` §5
- [ ] **Earn flows** — ad-grid / attention units, surveys, daily activities, earn-while-loading — consumer-
  protection review of the flows, hooks and reminders. → `EARN-HOOK-AND-REMINDER-COMPLIANT-DESIGN`, `EARN-WHILE-LOADING-SURVEY`
- [ ] **Prize competition (sweepstakes)** — confirm **skill/merit + AMOE free-entry** breaks the "consideration"
  prong; **state registration / bonding** (FL/NY $5,000, RI $500, block WA — confirm/extend); Official Rules;
  18+ gate. **(switch** `SWEEPSTAKES_REG_THRESHOLD`**)** → `FOR-YOUR-ATTORNEY` §3
- [ ] **Single-tier referral** (no downline) — no pyramid/MLM; reward is a finder's fee tied to a real paying
  advertiser; clawback-gated; contact-invite is user-sent (no server blast). → `REFERRAL-PROGRAM`, `REFERRAL-CONTACT-INVITE`
- [ ] **FTC endorsement disclosure** for creators/endorsers and one-tap social posting; enforced `#ad`;
  material-connection disclosure + monitoring; whether permanent human "tap Post" must stay. → `SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF`, `SOCIAL-POSTING-ONE-TAP-AND-CONSENT`
- [ ] **TCPA / CAN-SPAM** — SMS/email reminders and referral invites: consent, STOP/opt-out, timing, footer
  address. → `SMS-OPTIN`
- [ ] **FTC 2024 fake-reviews & testimonials rule** — no incentivized/undisclosed reviews; sentiment features
  reviewed against it. (added)
- [ ] **Dark-patterns / UDAP sweep** of the whole earn-and-upgrade funnel (FTC + CA/CO). (added) → `AI-FUNNEL-DESIGN`

### 6. Social, UGC & Buddy Chat  → folder `Social, UGC & Buddy Chat`

- [ ] **Buddy Chat / voice** — wiretap two-party consent + BIPA on recording; moderation + **CSAM / NCMEC**
  procedure; minors / age-assurance; mandatory-pairing dark-pattern concern; member-to-member safety;
  booking / scheduling mechanics. **(switch** OFF by default**)** → `BUDDY-CHAT-LEGAL-BRIEF`, `BUDDY-CHAT-SCHEDULING-AND-MATCHING`
- [ ] **Browsable member profiles** — opt-in consent, data minimization (first name + interests only),
  disclosure of making KYC-survey interests member-visible. → `SESSION-2026-09-01-COUNSEL-NOTE`
- [ ] **Section 230 / intermediary-liability** posture for user content, reviews, chat. (added)
- [ ] **Law-enforcement / subpoena response** + emergency-disclosure policy for member safety incidents. (added) → Part B

### 7. Browser extension / shopping helper  → folder `Browser Extension`

- [ ] **Consent-gated ingestion**; minimal data (merchant / total / commission); Chrome Web Store policy;
  reseller / affiliate legitimacy; dedicated privacy review before launch. → `BROWSER-EXTENSION-COUNSEL-BRIEF`, `SHOPPING-EXTENSION-AND-SERVICES`
- [ ] **Extension-specific privacy disclosure** + single-purpose / limited-use compliance for the Web Store. (added)

### 8. AI, autonomy & the custom model  → folder `AI, Autonomy & Model`

- [ ] **Autonomy delegated only over non-sensitive domains**, with **permanent human/counsel gates on money,
  identity, legal, pricing, tier**, and a global kill switch. → `AUTOMATION-MASTER-PLAN`, `CUSTOM-AI-MODEL-DESIGN-AND-ROADMAP`
- [ ] **Model-training data** — first-party-only hard guard + consent; no new data category. → `MODEL-TRAINING-DATA-COUNSEL-NOTE`
- [ ] **AI-generated advertising / art** — visible "AI-generated" label + C2PA provenance; depicts no real
  brands/people; EU AI Act + FTC disclosure. → `AI-CONTENT-DISCLOSURE-DESIGN`
- [ ] **AI moderation + DMCA** interplay; automated-decision transparency (GDPR Art. 22 / CPRA ADMT). → `AI-MODERATION-AND-DMCA`
- [ ] **AI-hosted advertiser sessions** — FTC AI + `#ad` disclosure; recording consent/retention. (added, flagged in `FOR-YOUR-ATTORNEY` header)

### 9. Intellectual property  → folder `Intellectual Property`

- [ ] **Patent** — file provisional → **PCT** within the priority year; scrub trade-secret-sensitive specifics
  before the non-provisional publishes; inventor assignment; **(added)** freedom-to-operate search. → `Provisional Patent\`
- [ ] **Trademark** — file (US base → **Madrid** designations); clearance search; brand + slogan + watermark. → `Trademarks\TRADEMARK-FILING-BRIEF`, `Trademarks\BRAND-AND-TRADEMARK`
- [ ] **Copyright** — automatic; US registration where enforcement needs it.
- [ ] **DMCA** — register the **designated agent** (Copyright Office); takedown / counter-notice copy; upload
  license-grant. → `AI-MODERATION-AND-DMCA`, `FOR-YOUR-ATTORNEY` §13
- [ ] **Open-source / third-party license compliance** — SBOM, attribution, license compatibility; fonts,
  images, music licensing for house creative. (added)
- [ ] **Trade-secret protection program** — access controls, confidentiality legends, exit procedures. (added)
- [ ] **Domain + social-handle brand protection.** (added)

### 10. Streaming, hosting & livestream monetization  → folder `Streaming & Hosting`

- [ ] **Public streaming / screen-mirroring** — DMCA / notice-and-takedown, moderation, age-gating before
  enable. **(switch** OFF**)** → `HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF`, `LIVESTREAM-ADVERTISING-COUNSEL-BRIEF`
- [ ] **Real-money skill tournaments** — regulated state-by-state, 18+, conflicts with the Site-Cash-only rule;
  do **not** enable without review (Site-Cash version is the safe default). → `HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF`
- [ ] **Session-recording consent / retention** for hosted/streamed sessions.
- [ ] **Third-party seller KYC / tax** for the marketplace + hosting monetization.

### 11. Global rollout, compliance posture & security  → folder `Global, Compliance & Security`

- [ ] **Per-market triage** — clear / needs-local-review / geo-restrict; **geo-restrict list**; lead-firm
  international network; EU/UK reps; VAT OSS; Madrid / PCT. → `GLOBAL-LAUNCH-LEGAL-STRATEGY-BRIEF`, `GLOBAL-COMPLIANCE-AND-LOCALIZATION`
- [ ] **EU Digital Services Act (DSA)** / **DMA** applicability; **ePrivacy** cookie-consent; per-country
  consumer law; **Canada CASL / PIPEDA**, Australia, etc. (added)
- [ ] **Localization / culturalization** legal review of translated surfaces + auto-translation accuracy. → `LOCALIZATION-CULTURALIZATION-COUNSEL-NOTE`, `SURVEY-AUTO-TRANSLATION`
- [ ] **Strictest-standard compliance policy** — confirm the "apply the strictest applicable rule globally"
  posture is workable and documented. → `STRICTEST-STANDARD-COMPLIANCE-POLICY`, `COMPLIANCE-AND-ASSUMPTIONS`
- [ ] **Security & breach** — breach-notification plan; TIN masking + owner-scoped RLS + encryption-at-rest /
  provider custody; data-in-transit posture; **(added)** incident-response plan + vulnerability-disclosure /
  bug-bounty policy + records-retention & legal-hold policy. → `DATA-IN-TRANSIT-SECURITY-POSTURE-COUNSEL-NOTE`
- [ ] **Biometric / step-up auth** posture confirmation. → `BIOMETRIC-AND-STEP-UP-AUTH-COUNSEL-NOTE`

### 12. App-store & mobile  → folder `Global, Compliance & Security` (or its own)

- [ ] **Apple LEULA minimum terms** (third-party-beneficiary, no-Apple-responsibility) + **Google Play**;
  **OTA-update** disclosure; app privacy labels; age rating. → `MOBILE-OTA-LIVE-UPDATES`, `PRIVACY-LABELS-AND-DATA-SAFETY`
- [ ] **App-store policy review** for rewards / sweepstakes / real-money mechanics, external-purchase links, and
  Sign in with Apple. (added)

### 13. The launch gate (final sign-off)

- [ ] Confirm every money-/credit-/minor-/chance-/biometric-/auto-charge-related capability ships **OFF behind
  its named switch** and is flipped **only after** counsel clears it. → `FOR-YOUR-ATTORNEY` "How the safeguards work"
- [ ] Explicit written sign-off before enabling: `cash_out`, any credit product, `FOUNDING_FREE_TRIAL_*`,
  `teen_accounts`, `session_screenshots`, any auto-renewal, and any newly-launched regulated feature.
- [ ] **Under-18 / teen accounts** — if ever enabled: verifiable parental consent, minor-data handling (COPPA +
  state analogs), updated Terms/Privacy, app-store age-rating change. **(switch** `teen_accounts` OFF**)** → `FOR-YOUR-ATTORNEY` §4
- [ ] Confirm insurance is bound (§0) and the entity/contracts/IP filings (Part B) are executed.

---

## Part B — Documents & work-product for counsel to draft or finalize

Review items in Part A confirm what exists; these are the pieces counsel should **produce**. Many are drafted in
skeleton form in the packet and only need finalizing; those I mark **→ draft exists**.

- [ ] **Entity formation set** — articles, operating agreement / bylaws, organizational resolutions, IP-assignment
  agreements (founders + contractors), EIN + BOI filing. (added) → draft created (`CORPORATE-FORMATION-AND-GOVERNANCE-BRIEF`)
- [ ] **Terms of Service** — finalize. → draft exists
- [ ] **EULA** — finalize incl. Apple/Google minimum terms. → draft exists
- [ ] **Privacy Policy + Cookie Notice + app privacy labels** — finalize. → draft exists
- [ ] **Refund, Acceptable-Use, Accessibility** policies — finalize. → draft exists
- [ ] **Community Guidelines** (public companion to the AUP). (added) → draft created (`COMMUNITY-GUIDELINES`)
- [ ] **Advertiser Contract** + **Advertiser Terms** — finalize the signable form. → draft exists
- [ ] **Partner / Affiliate / Developer Agreement** — independent-contractor classification, W-9/tax,
  developer-IP (work-for-hire vs. license) + open-source, liability/indemnity. → draft exists
- [ ] **Marketplace / third-party seller agreement** + seller KYC/tax onboarding. → draft exists (`MARKETPLACE-SELLER-TERMS`)
- [ ] **Data Processing Agreement (DPA)** template + **SCCs / UK IDTA** + sub-processor list + RoPA + DPIA. (added) → draft created (`DATA-PROCESSING-AND-SUBPROCESSOR-BRIEF`)
- [ ] **Biometric consent + data policy** (BIPA/CUBI/WA) with retention/destruction schedule. (added) → draft created (`BIOMETRIC-CONSENT-AND-DATA-POLICY-BRIEF`)
- [ ] **NDA templates** — mutual + one-way. (added) → draft created (`NDA-TEMPLATES-BRIEF`)
- [ ] **Endorser / influencer agreement** (paid-endorser program) with enforced `#ad`. (added) → draft created (`ENDORSER-INFLUENCER-AGREEMENT-BRIEF`)
- [ ] **Sweepstakes Official Rules** + state registrations/bonds. → draft generated from settings
- [ ] **DMCA designated-agent registration** + takedown/counter-notice/upload-license copy. → draft exists
- [ ] **Law-enforcement / subpoena-response & emergency-disclosure policy.** (added) → draft created (`SECURITY-AND-GOVERNANCE-POLICIES-BRIEF` §4)
- [ ] **Incident-response plan**, **vulnerability-disclosure / bug-bounty policy**, **records-retention & legal-
  hold policy.** (added) → draft created (`SECURITY-AND-GOVERNANCE-POLICIES-BRIEF` §§1-3)
- [ ] **Patent** — provisional filing → PCT; trademark applications (US → Madrid); copyright registrations. → drafts exist (`Provisional Patent\`, `Trademarks\`)
- [ ] **Insurance** — bind the program in §0. (added) → draft created (`INSURANCE-COVERAGE-BRIEF`)
- [ ] **(CPA) Tax registrations & filings** — sales-tax/VAT registrations, 1099 provider onboarding, entity tax
  calendar, revenue-recognition memo. → supported by `TAX-OBLIGATIONS-AND-FILINGS-BRIEF`

---

*Not legal advice; an inventor-prepared master checklist for a licensed attorney (and a CPA where marked). The
`COUNSEL-ENGAGEMENT-START-HERE` guide is the front-of-packet on-ramp and `FOR-YOUR-ATTORNEY` is the switch-level
compliance map; this document is the complete action list that ties them together and supersedes
`LAWYER-TODO-FULL-SITE`.*
