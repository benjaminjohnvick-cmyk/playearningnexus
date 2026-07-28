# AI Cost Worksheet (owner, ~15 minutes)

Fill this before launch to set your AI/image budget. These are env variables (Railway Variables UI, or
`backend/.env`), also editable live in Admin → Platform Settings. Defaults are already the low-cost
posture — you're mostly confirming.

## 1. Image budget (one-time, covers all countries)
| Variable | Set to | Effect |
|---|---|---|
| `IMAGE_PROVIDER` | `aws_bedrock` | Serverless GPU, pay-per-image |
| `IMAGE_MODEL` | `amazon.titan-image-generator-v1` | ~$0.01/image (cheapest) |
| `CATALOG_IMAGES_ENABLED` | `1` (or `0` for $0 text-only launch) | Master switch |
| `CATALOG_SUBCATEGORY_IMAGES` | `0` | Top-level tiles only (cheap) |
| `CATALOG_IMAGES_MAX_PER_RUN` | `100` | Paces spend across runs |
| `AWS_REGION`,`AWS_ACCESS_KEY_ID`,`AWS_SECRET_ACCESS_KEY` | your IAM creds | Activates Bedrock |

Estimated one-time image spend: **~$9–15** (≈945 images × ~$0.01). Leave creds unset to launch at $0.

## 2. LLM budget (ongoing text)
| Variable | Set to | Effect |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` or `openai` | Which brain |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | your key | Enables text AI |
| `LLM_MODEL_SMALL` / `CLAUDE_MODEL_SMALL` | small tier | Catalog/browse/translation use this |
| `AI_DAILY_SPEND_CAP_USD` | e.g. `10` | Hard daily brake on LLM spend |

Catalog seed + browse-node expansion is ~900 small calls total (a few dollars, paced). Set the daily
cap to your comfort number; the AI cannot exceed it.

## 3. Catalog size at launch
| Variable | Set to | Effect |
|---|---|---|
| `CATALOG_COUNTRIES` | start `US` | Add countries later (clones reuse images) |
| `CATALOG_LISTINGS_PER_COUNTRY` | start `80`, grow later | Fewer products = less seed cost |
| `CATALOG_CATEGORY_SOURCE` | `taxonomy` | Span the full taxonomy |

## 4. Free/cheap infra (confirm)
- Hosting: Railway ~$10–30/mo at launch. Scale toggles (`REDIS_URL`, `DATABASE_REPLICA_URL`,
  `QUEUE_DRIVER`) left **unset** until the load test says otherwise.
- Geo-IP + exchange rates: free tiers, cached. Static fallbacks exist.

## My numbers (fill in)
- One-time image spend target: __________
- Monthly LLM cap (`AI_DAILY_SPEND_CAP_USD` × 30): __________
- Launch countries: __________  · Listings per country: __________
- Total expected month-1 AI/image cost: __________ (target: under ~$100)
