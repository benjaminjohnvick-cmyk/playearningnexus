# Swappable AI-Model Module + Graduated-Autonomy Expansion — Design Map

*How the platform chooses which AI model runs which job (built to swap models and whole vendors without touching
call sites), how GPT-6 Astra and a unified model gateway plug in, and exactly which operational tasks may run on
their own versus which stay permanently human-gated. Current as of 2026-09-08. **Not legal advice** — the
gate classification below is a compliance posture for counsel to confirm.*

---

## Part 1 — The swappable AI-model module

### The problem it solves

The platform calls the LLM from ~190 places. If each place named a model, swapping to a new model (or a new
company's model) would mean editing 190 files. Instead, every call names a **job** — "document", "reasoning",
"ad_copy" — and one module decides **which model runs that job**. Swapping in a future model becomes a one-row
change; re-pointing a job at it is a settings change. Nothing else moves.

### Two layers that compose

| Layer | File | Responsibility |
|---|---|---|
| **Portfolio / routing** | `backend/sdk/ai-models.ts` (new) | *Which* model for this job — the registry + the job→model map |
| **Transport** | `backend/sdk/integrations.ts` (`resolveModelId` + `InvokeLLM`) | *How* to call the active provider for that model |

A call site does one thing:

```ts
import { modelForJob } from "../../sdk/ai-models.ts";
const out = await Core.InvokeLLM({ model: modelForJob("document"), prompt });
```

`modelForJob("document")` returns a **tier alias**; `resolveModelId` maps that alias to the concrete model id
for whichever provider is live (`openai | anthropic | groq | self | gateway`).

### The registry (add a model = add a row)

`MODELS` in `ai-models.ts` currently holds three rows: **cheap** (high-volume, default — Llama on Groq's free
tier), **standard** (real reasoning), and **astra** (GPT-6 Astra, the frontier tier). Each row carries a label,
the tier alias, a provider hint, a full `vendor/model` gateway id, a cost tier, and its capabilities. A future
flagship is just a new row plus, if you want a job to use it, one setting.

### GPT-6 Astra, wired in

Astra is the `astra` registry row → the **`frontier`** tier → `gpt-6-astra` on OpenAI (also on AWS Bedrock, and
reachable through the gateway). It's pointed at the hard, high-value jobs (**document generation**, and available
for **ops reasoning**). Because it costs ~$10 / $50 per million tokens (input / output) — roughly 2.5× the current
generation — it is **opt-in**: the global `AI_FORCE_CHEAP_TIER` brake (ON by default) downgrades even the frontier
tier to cheap, so **Astra only actually runs once you turn that brake OFF**. Until then every job transparently
runs cheap and spend stays capped. That is the honest cost posture: frontier power on the few jobs that earn it,
cheap everywhere else.

### The unified gateway ("one API, every company's models, always the latest")

Set `LLM_PROVIDER=gateway` and point `AI_GATEWAY_URL` at an **OpenRouter-style** unified, OpenAI-compatible
endpoint (needs `AI_GATEWAY_KEY`). One key then reaches every company's models by id, and adding a
newly-released model is a settings change (`GATEWAY_MODEL_*`) or a registry id bump — no new code path. Options in
this space today include **OpenRouter** (the closest to "all models, adds the latest continuously"), plus Eden AI,
Together, CometAPI, Requesty, and the cloud marketplaces (AWS Bedrock, Azure AI Foundry, Google Vertex);
**LiteLLM** is the self-hostable version of the same idea. Honest caveat: **no gateway guarantees a brand-new
model on day one** — providers gate early access (Astra itself launched to trusted orgs first) — so treat the
registry as the place you bump ids as models ship.

### Admin visibility

`aiModelStatus` (new admin endpoint) shows the registry, the **effective** job routing (with any overrides), the
active provider/gateway, and whether the frontier tier can run right now. Everything is controlled from settings:
`LLM_PROVIDER`, `AI_FORCE_CHEAP_TIER`, `LLM_MODEL_FRONTIER` / `CLAUDE_MODEL_FRONTIER`, `AI_GATEWAY_URL`,
`GATEWAY_MODEL_*`, and per-job `AI_JOB_MODEL_<JOB>`.

---

## Part 2 — Graduated-autonomy expansion

### The rule that never changes

Every automatable decision belongs to a **domain**, and each domain is one of two classes (`autonomy-kernel.ts`):

- **`auto_ok`** — safe, reversible, high-volume. Starts human-gated and **earns** autonomy from data (enough
  approved runs + high agreement with the human + a deep-enough playbook). Can reach full auto.
- **`permanent_gate`** — money, identity, legal, or risk. **Never** auto-approves, no matter how capable the
  model or how much data exists, because the risk is legal and irreversible, not a matter of confidence. The AI
  still does the work and recommends; a human (and, where needed, counsel) taps once.

A more capable model (Astra, or "AGI"-labelled) **widens what the reversible lane can carry — it does not move the
gate.** The gates exist because a business needs a legally accountable human on money, identity, legal, and
irreversible actions; capability doesn't change accountability. This expansion adds the operational tasks of
"running the business" to the reversible lane and keeps — in fact hardens — the gated spine.

### What moves toward "auto" (reversible operational loop)

| Domain | Group | Runs on | Why it's safe to graduate |
|---|---|---|---|
| Ad creative, social posts, survey design, video | content | creative / ad_copy | Reversible content; already in the kernel |
| **Ad delivery optimization** | revenue | ops_reasoning | Reallocates **inside** fixed budget/rate caps — never raises spend |
| **Content calendar scheduling** | content | creative | Scheduling owned posts; unschedulable |
| **SEO metadata & on-page copy** | content | creative | Editable, reversible page copy |
| **Homepage / feed personalization** | revenue | reasoning | Ranking/layout only; no money or identity |
| **Analytics & performance reporting** | ops | document (Astra) | Read-only measurement + written insight |
| **Internal document & report generation** | ops | document (Astra) | Internal drafts; publishing external/legal stays gated |
| **Infra / anomaly monitoring & suggestions** | ops | ops_reasoning | Watches and recommends; changing config is gated |
| **Content moderation triage** | risk | reasoning | Flags and **queues** only; the actual removal is gated |
| Recommendations, catalog/merch, matching, onboarding, support drafts | revenue/ops | reasoning / support | Reversible personalization and drafts |

These graduate on the existing trust ladder (`manual → earned → full`), governed by `AUTONOMY_TRUST_MIN_RUNS`,
`AUTONOMY_TRUST_MIN_AGREEMENT`, `AUTONOMY_TRUST_MIN_DATA`, and always inside their per-domain budget/rate caps.
Astra is the reasoning behind the `ops_reasoning` and `document` jobs, so as autonomy widens, the *quality* of the
autonomous work rises without the gate moving.

### What stays permanently human-gated (the compliance spine)

| Domain | Group | Why it never auto-approves |
|---|---|---|
| Payouts / withdrawals | money | Money out — money-transmission risk |
| Refunds above threshold | money | Money out |
| Billing / subscription changes | money | Negative-option-billing risk — counsel-gated |
| **Advertiser pricing / billing changes** | money | What advertisers are charged — money & contract |
| KYC / tax (W-9 / 1099) | identity | Regulated identity data |
| **External data sharing / exports** | identity | Privacy-gated (GDPR/CCPA) |
| Disputes / chargebacks | risk | Legal & financial exposure |
| Bans / account actions | risk | Irreversible to the user |
| **Security / infra configuration changes** | risk | Prohibited-action class — human only |
| Legal / public terms & claims | legal | Legal exposure; public commitments |

Every autonomous action is logged to the oversight feed (`logAiAction`) and is reversible; the global
`AUTONOMY_KILL_SWITCH` forces everything back to the human gate in one flip.

### The honest bottom line on "let Astra run the business"

OpenAI said Astra *"may represent"* AGI — a contested claim, released amid active safety scrutiny (it can chain
zero-days), which is a reason for **more** guardrails, not fewer. The achievable and responsible target is a
business that is **~90% AI-operated day to day** — content, ads within caps, personalization, monitoring,
reporting, document drafting, support drafts, catalog work all flowing through the reversible lane on the trust
ladder — with a **thin human layer** owning the legal, financial, and irreversible ~10%. That is exactly what this
architecture delivers, and none of the gates should be removed because a model got smarter.

---

## Files (for the record)

- **New:** `backend/sdk/ai-models.ts` (registry + job routing), `backend/functions/aiModelStatus/entry.ts` (admin status).
- **Changed:** `backend/sdk/integrations.ts` (frontier tier + raw-id passthrough + `gateway` provider),
  `backend/sdk/autonomy-kernel.ts` (expanded operational domains), `backend/sdk/settings.ts` (frontier / gateway /
  per-job settings + `gateway` provider option), `backend/functions/advertiserWeeklyReport/entry.ts` (routes its
  report through the `document` job), `backend/functions/_manifest.json` (registers `aiModelStatus`).

## Related docs

- `SERVER-GPU-USES.md` — the image/video generation lanes (separate from the LLM router here).
- `AD-MEDIA-AND-TARGETING-DESIGN.md` — the self-learning ad targeting layer (same autonomy posture).
- `AUTOMATION-MASTER-PLAN.md` / `AI-SITE-MAINTENANCE.md` — the broader automation program.

*Prepared for the owner. Not legal advice — the gate classification is a compliance posture for counsel to confirm.*
