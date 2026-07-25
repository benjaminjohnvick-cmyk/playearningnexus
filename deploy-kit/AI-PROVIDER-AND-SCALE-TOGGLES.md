# AI Provider & Scale Toggles — plug-and-play

These are **built into the codebase and off by default**. Each is a single env variable — no code
change, no redeploy of a different build. They exist so that "run Claude for the AI" and "scale up
when traffic comes" are **flips a developer sets in the Railway Variables UI**, not billable rework.
Because they were pre-built into the kit, they add **$0 to the launch estimate** — the estimate stays
flat at **~30–45 h (~$2,250–$3,375)** for the full PWA + Android + iOS launch.

---

## 1. Run Claude for all AI (the "Claude switch")

Set two variables and every text/reasoning call — `InvokeLLM` **and all 76 agents** — routes through
Claude instead of OpenAI:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

That's the whole switch. What happens under the hood, so you can trust it:

- The agents keep their per-agent model pins in `agent-guardrails.json` (OpenAI ids). At runtime those
  translate to Claude equivalents — `gpt-4o → claude-3-5-sonnet`, `gpt-4o-mini → claude-3-5-haiku`.
  Override the mapping with `CLAUDE_MODEL_LARGE` / `CLAUDE_MODEL_SMALL` / `CLAUDE_MODEL_DEFAULT`.
- The two APIs describe tools and return tool calls differently; the agent runtime handles both
  formats, so agent tool-use works on Claude exactly as on OpenAI.
- The daily USD spend caps stay accurate — Claude per-token prices are already in the pricing table.
- **Flipping back is exact:** set `LLM_PROVIDER=openai` and you're on OpenAI again, no residue.
- Optional flat override: set `ANTHROPIC_MODEL` to force one Claude model for every tier.

Verify after flipping: `node backend/tools/validate-guardrails.mjs` (every agent still pinned + capped)
and one live `InvokeLLM` call.

### Images / voice / embeddings — the small companion provider
Claude has no image, text-to-speech, or embeddings API, so those keep a small secondary key. Image
generation is toggle-driven:

```
IMAGE_PROVIDER=openai        # or: stability
IMAGE_API_KEY=...            # optional separate key; else uses OPENAI_API_KEY / STABILITY_API_KEY
```

So a Claude-for-everything-text setup runs Claude as the brain + one small image key. Nothing else
changes.

---

## 2. Scale-ready toggles (dormant until you need them)

All three are **no-ops when unset** — the app behaves exactly as it does today on one instance, at no
extra cost. Turn one on when the numbers say so (the load test tells you which ceiling you hit first).

| Turn on | By setting | What it does |
|---|---|---|
| **Shared cache (Redis)** | `REDIS_URL=redis://…` | Hot reads (prize pool, leaderboard, rate-limit counters) served from ElastiCache instead of hammering Postgres. Unset = process-local in-memory cache. |
| **Read replica** | `DATABASE_REPLICA_URL=postgres://…` | Read queries (`filter`/`list`) route to a Postgres read replica; writes stay on the primary. Falls back to primary if the replica blips. Unset = all reads on primary. |
| **Worker fleet (SQS)** | `QUEUE_DRIVER=sqs` + `SQS_QUEUE_URL=…` | Slow/external jobs (LLM, email, SMS, payouts) fan out to a separate worker tier that scales on queue depth. Unset = jobs run in-process behind the concurrency limiter (today's behaviour). |

Each is best-effort: a Redis hiccup, a replica outage, or an SQS send failure **degrades to the
current single-instance path** rather than failing a request. That's deliberate — turning a scale knob
should never be able to take the app down.

### Recommended launch posture
Leave **all of section 2 unset at launch.** You launch cheap on one instance (single-service mode:
`AUTO_MIGRATE`, `SCHEDULER_INLINE`, `FRONTEND_DIR`). When real traffic arrives, run the load test,
then flip the one knob that your measured bottleneck calls for. You never pay for the scale
architecture before you have the users — and you never rewrite code to get it.

---

## Where this lives in the code (for the developer)
- Claude switch + image toggle: `backend/sdk/integrations.ts` (`resolveModelId`, `GenerateImage`) and
  `backend/agents-runtime/agent-runtime.ts` (provider-aware tool-use loop); pricing/aliases in
  `backend/agents-runtime/agent-guardrails.json`.
- Redis cache: `backend/sdk/cache.ts` — `cacheGet/cacheSet/cached`, ready to wrap hot reads.
- Read replica: `backend/sdk/db.ts` — `withReadClient`, already used by `db.filter`.
- SQS worker path: `backend/sdk/queue.ts` — `enqueue()`, same call site in both modes.
