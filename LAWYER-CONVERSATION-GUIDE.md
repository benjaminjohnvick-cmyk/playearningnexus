# Lawyer Conversation Guide — AI Models, Autonomy & Data

*A focused agenda for your attorney covering the items this session flagged for legal review. Each section states
the situation plainly and lists the specific questions to ask. Bring the referenced docs. **This guide is not
legal advice** — it's a prep sheet so the conversation is efficient.*

---

## 1. Using AI outputs to train our own models

**Situation.** The platform calls third-party models (Claude, GPT-6 Astra, others via a gateway) at runtime. We
also have self-learning components (ad targeting, personalization, ranking) that could be seeded or labeled with
AI-generated data. Provider terms (Anthropic and OpenAI) allow using outputs to build **specialized,
non-competing** tools but prohibit training a **competing general-purpose model** or using outputs as its
training targets.

**Ask counsel:**
- Do our self-learning models (cohort targeting, recommendation ranking, personalization) clearly qualify as
  "specialized, non-competing" tools under each provider's terms?
- Is there any use — now or planned — that could be read as training a competing model or using outputs as
  training targets? Where exactly is the line for us?
- Do we need written permission from any provider for any current or planned use?

## 2. Bootstrapping on public / scraped data

**Situation.** To have the learning models useful from day one, we want real-world priors. The plan is to use
**licensed open datasets and published statistics**, avoid personal data, and avoid bulk-scraping third-party
sites against their terms.

**Ask counsel:**
- For each intended data source: is our use within its license / terms? Which sources are safe to rely on?
- Confirm we should **not** scrape personal data (GDPR/CCPA apply even to "public" personal data) — any nuance?
- Before any bulk scrape of a specific site, what's our sign-off process? What are the ToS-breach / database-right
  / CFAA-adjacent risks in our jurisdiction?
- Constraint we're already applying: synthetic/LLM-seeded data is an internal warm-start only and is never shown
  to users or advertisers as real activity. Is that sufficient, or do we need disclosure anywhere?

## 3. Autonomy, accountability & the permanent-gate list

**Situation.** The platform can increasingly run itself: reversible operational actions (content, personalization,
ad-slot reallocation, catalog rotation, survey distribution) graduate to autonomous on a trust ladder, while a
**permanent-gate spine** always requires a human — payouts, refunds, billing, advertiser billing, KYC/tax,
disputes, account bans, security config, and legal/public content. We hold that "100% autonomous with no
accountable human" is not lawful/advisable, regardless of any "AGI" claim about the model.

**Ask counsel:**
- Is our permanent-gate list complete and correct for our jurisdiction and business model? What would you add or
  reclassify?
- Which of the gated actions require not just *a* human but a *licensed* professional or a specific approval
  record (e.g., money transmission, tax, disputes)?
- What records/audit trail should we keep for autonomous actions to satisfy accountability and consumer-protection
  expectations? (We log every action and every approval; is that the right shape?)
- Any disclosure obligation to users that parts of the service are AI-operated?

## 4. Standing items to confirm (already documented — bring these)

- **Ad targeting & privacy** (`AD-MEDIA-AND-TARGETING-DESIGN.md`): first-party, non-sensitive cohort targeting;
  targeted-advertising opt-out obligations; privacy-policy coverage; no sensitive/protected-class targeting.
- **AI-content disclosure** (`AI-CONTENT-DISCLOSURE-DESIGN.md`): the "AI-generated" label + C2PA provenance, the
  "never a real/identifiable person" rule, and `#ad` disclosures.
- **Closed-loop points / money-transmission posture** and KYC/1099 (`PAYOUT-CLOSED-LOOP.md`, `TAX-1099-PIPELINE.md`).

## 5. Reference docs for this conversation

- `SESSION-2026-09-07-AI-MODEL-AUTONOMY-AND-DATA-SUMMARY.md` — the one-page summary of what was built + these flags.
- `AI-MODEL-MODULE-AND-AUTONOMY-MAP.md`, `AUTONOMY-GATING-AND-OVERSIGHT.md`, `LAUNCH-ACTIVATION-CHECKLIST.md`.

*Prepared for the owner to take to counsel. Not legal advice.*
