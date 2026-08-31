# Localization / Culturalization — Counsel Note

*Plain-English brief for legal review. This describes a feature set that adapts platform-generated
content to a target country's language and customs. It is written for an attorney; nothing here is a
legal conclusion.*

## What the feature does

When the platform generates marketing/commerce content, it can optionally adapt that content to a
target market's **language** and **customs** (tone, examples, date/number formats, culturally relevant
framing) — not just translate the words. Adaptation is performed at runtime by an LLM from a prompt the
platform builds; the output is stored as a per-market display variant alongside the original.

Where it is wired in today (each is independently gated and OFF by default):

- **Product listings** — when a seller/creator create-flow supplies target markets, the listing's title
  and description are adapted per market (`createMarketplaceListing`).
- **AI catalog** — when the platform's AI catalog seeder clones its own original template products into a
  country, it can adapt each product's title/description to that country
  (`aiCatalogSeed` / `cloneTemplatesToCountry`).
- **Promotions** — when a promo code is created, its AI-generated notification message and email subject
  can be adapted per target market (`autoPromoCodeLifecycle`).
- **Tutorial & guidebook, AI ad visuals** — the in-app tutorial and downloadable guidebook can be
  translated + culturally adapted; AI-ad image/video prompts can additionally be styled to the local
  market ("visual aesthetic" cue).

## Guardrails built into every adaptation prompt

The same guardrail string is baked into every localization/culturalization prompt:

> Adapt respectfully and specifically to this market **without stereotypes or broad generalizations; do
> not target, exclude, or caricature any protected class**; comply with local advertising/consumer norms
> and law; keep all facts, prices, and claims unchanged and make no guaranteed-result claims.

In addition:

- **Facts, prices, and claims are held unchanged.** Localization changes wording and cultural framing
  only. Prices shown per country come from a separate, deterministic currency step, not from the LLM.
- **The base (English) content is preserved.** Adapted catalog products keep the original title/description
  in `base_title` / `base_description`; listings and promos keep the original as the authoritative record.
- **Adaptations are labeled reviewable.** Each adaptation returns `cultural_notes` — a short list of what
  was changed — so a human can review before relying on it. The system treats cultural adaptation as
  assistive and potentially wrong.
- **Bounded and gated.** Every path is OFF by default behind a setting; catalog localization is additionally
  capped per country and runs as a single batched call, so it cannot silently fan out.

## Why this is flagged for counsel — the review questions

1. **Advertising / consumer-protection law varies by market.** Adapted promotional copy is still
   advertising in the destination country. Counsel should confirm the "comply with local advertising and
   consumer law" instruction is adequate, or whether specific jurisdictions need harder rules or human
   sign-off before adapted copy is shown/sent.
2. **Anti-discrimination / protected-class targeting.** The guardrail forbids stereotyping or
   targeting/excluding protected classes, but the feature does adapt content *by country/market*. Counsel
   should confirm that market-based adaptation, as implemented, does not create a
   discrimination-in-advertising exposure (e.g. housing/credit/employment-adjacent categories, if any).
3. **Accuracy / liability for machine translation.** Because an LLM produces the adapted wording, there is
   a risk of mistranslation or a culturally-off phrasing. The `cultural_notes` + preserved original +
   human-review posture are the current mitigations; counsel should advise whether human review should be
   mandatory (vs. optional) before adapted content is published in specific contexts.
4. **Claims parity across languages.** Facts/prices/claims are instructed to stay unchanged, but counsel
   may want a verification step so that a disclosure or disclaimer required in English is provably carried
   into every adapted variant (e.g. `#ad`, "no guaranteed results," eligibility/limits).
5. **Emails/notifications.** Adapted promo *subjects and messages* may be sent to users; this intersects
   with the platform's existing consent/marketing-message posture. Counsel should confirm adapted messaging
   inherits the same opt-in/CAN-SPAM/local-equivalent controls as the base messaging.

## What has NOT changed

The money model, closed-loop Site Cash rule, disclosure rules (AI ads disclosed as AI + `#ad`, never
impersonating a real person, no guaranteed income/ROI), and all existing gates are unchanged by this
feature. Localization is a presentation layer over content the platform was already generating.
