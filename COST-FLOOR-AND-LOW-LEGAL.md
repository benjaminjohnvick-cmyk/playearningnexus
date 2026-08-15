# Cost Floor + Lowest Legal-Cost Launch

*Quick reference for running the platform at the lowest possible operating and legal cost. Companion to
`UNDER-5K-EXECUTION-KIT.md`. Not legal advice.*

## Drop AI/media cost to the floor (one click)

Admin → **Setup Wizard → "Drop cost to the floor"** (or call `costFloorProfile`). It sets, reversibly:

| Capability | Floor setting | Result |
|---|---|---|
| LLM (all AI) | `LLM_PROVIDER` → `self` if `SELF_LLM_URL` set, else `groq` | Llama, free tier / your GPU |
| All LLM tiers | `AI_FORCE_CHEAP_TIER` = ON | every call uses small Llama (8B) |
| Speech-to-text | `PROVIDER_STT` → `self` else `groq` | Whisper, free tier / your GPU |
| Text-to-speech | `PROVIDER_TTS` → `self` else `polly` | off ElevenLabs → Polly free tier |
| Image gen | `IMAGE_PROVIDER` → `self` if `SELF_IMAGE_URL` set | your SDXL/FLUX = $0 (else stays managed) |
| Spend brake | `AI_DAILY_SPEND_CAP_USD` = 5 (tunable) | hard daily ceiling |

## Dumping more into Llama

`AI_FORCE_CHEAP_TIER` is the big lever: the ~190 AI call sites all resolve to `llama-3.1-8b-instant` on Groq's
free tier. **Safe to run on the small Llama:** concierge/funnel copy, moderation, ranking, survey-autofill
assist, translation, ad-copy drafting, sentiment, support triage, catalog text. **Keep the 70B (force OFF) for:**
multi-step reasoning, dispute adjudication, careful math. Image generation is separate and already free-tier;
add a `SELF_IMAGE_URL` to take it to $0 on your own GPU.

## Lowest legal & compliance cost

Same trick as Tier 2 (pay-as-you-go, not credit) and Flexible Payments (credit-card only): **launch on the
features that need no lawyer or license; leave the counsel-gated ones OFF until revenue justifies them.**

**OFF at launch — cost nothing until you engage a finance attorney (all default OFF, refuse to originate):**
`flexpay`, `tier1_financed`, `goods_advance`.

**ON at launch — straightforward by design, no lender/counsel gate:**
- Tier 1 (normal upfront purchase)
- Tier 2 "Scale" (30-day pay-as-you-go parts → not credit)
- Rollover/upgrade discount, premium gift boost (advertiser-funded store credit, not securities/credit)
- Flexible Payments in **`self_financed`** mode — a 0%/4-installment/credit-card plan that *may* fit the
  four-installment exemption; needs a **one-time** attorney read, not an ongoing lender.

**Runs compliant at $0 legal cost:**
- Earnings/results claims via the **hypothetical → substantiated** pattern (show "how it works" until real
  data passes the sample threshold, then auto-publish the substantiated figure with its basis). No counsel
  needed for a hypothetical; substantiated = your own real data.
- Code-enforced invariants: no customer markup (`customer_paid_usd = 0`), non-cashable closed-loop points
  (money-transmission shield), FTC disclosures on referrals/ads, consent-gated email with CAN-SPAM footer.

**Net near-term legal cost:** one attorney read of the `self_financed` four-installment plan **if** you want
pay-over-time on day one — otherwise ~$0 until you decide to switch on a credit product.
