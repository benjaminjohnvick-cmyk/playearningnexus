# Compliance & Current State

**Prepared: July 28, 2026.** A fresh statement of how GamerGain / PlayEarning Nexus works today and its
posture on the issues that can be addressed in code. This document is written from scratch and does not
carry over text from earlier compliance notes. It is not legal advice; have counsel review it against
your jurisdictions before launch.

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
