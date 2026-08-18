# AI Advertiser Performance Reports

*The automatic, AI-driven weekly performance report for every advertiser, across all tiers and offers. It
measures the conventional pay-per-click metric set from real activity, benchmarks it against standard PPC norms,
and writes recommendations — without ever guaranteeing a return. Not legal advice.*

## What it does

Once a week, for **every** advertiser on the platform — Tier 1, the founding offer, and Tier 2 alike — the
system measures how that advertiser's campaigns actually performed, compares the numbers to standard PPC
industry benchmarks, and has the AI write a short plain-language summary plus three to five specific,
actionable recommendations. The report is stored (so it shows on the advertiser's dashboard) and emailed to the
advertiser. No per-advertiser human is involved; it runs automatically.

The same measurement engine also answers an **on-demand** dashboard read, so an advertiser (or an adviser
reviewing on their behalf) can pull the current numbers any time, not just once a week.

## The metrics it tracks (conventional PPC set)

Everything is computed from **real platform activity**, not estimates:

- **Impressions** — served through ad listings and the tier seat counter.
- **Clicks** — from ad listings and the per-click `AdTransaction` ledger within the window.
- **CTR** — clicks ÷ impressions.
- **CPC** — spend ÷ clicks.
- **Conversions** and **conversion rate** — on-platform completions/attributed orders ÷ clicks.
- **CPA** — spend ÷ conversions.
- **Revenue** — on-platform attributed sales, plus connected off-platform revenue **only if** the advertiser
  reported/connected it (flagged when it's included).
- **ROAS** and **ROI** — revenue ÷ spend, and (revenue − spend) ÷ spend.
- **Social + engagement attribution** — posts, social-driven clicks, social-attributed revenue, and engagement
  events, tracking the traffic and revenue generated from social posts and user engagement.

Each metric is compared to an admin-tunable industry benchmark (CTR 1.9%, CPC $2, conversion 3%, CPA $45,
ROAS 2.5× by default) and marked **above / at / below** what's good for that metric.

## The honesty rules (why it can't "guarantee ROI")

The original ask was to "make sure PPC ads return the standard PPC ROI." No advertising platform can *guarantee*
a return — doing so is an unsubstantiated performance claim that both the FTC and payment processors treat as a
red flag. So the system does the compliant, defensible version of that intent:

- It **measures** each advertiser's actual ROI/ROAS from real data.
- It **benchmarks** that against standard PPC norms so the advertiser sees where they stand.
- The AI ad manager **optimizes toward** better performance.
- It **never promises or guarantees** a return. The weekly AI prompt is explicitly instructed to recommend, not
  promise, and never to state or imply a guaranteed ROI.
- It **never invents numbers.** Below the data threshold (default 1,000 impressions / 30 clicks in the window),
  the report is marked *"still gathering data"* and shows no fabricated ratios.
- **On-platform metrics are measured; off-platform revenue is only counted when the advertiser connected it**,
  and is flagged as such.

## Components

- `backend/sdk/advertiser-metrics.ts` — the measurement backbone: `computeAdvertiserMetrics()`, `ppcBenchmarks()`,
  `benchmarkComparison()`, and the substantiation threshold. Shared by the report and the dashboard read (and
  available to the pay-from-results rev-share, which needs the same trustworthy numbers).
- `backend/functions/advertiserWeeklyReport/entry.ts` — the scheduled sweep across all advertisers (or a manual
  single-advertiser call with `{self:true}`). Computes metrics → benchmark comparison → AI summary +
  recommendations → stores an `AdvertiserReport` → emails the advertiser.
- `backend/functions/advertiserPerformance/entry.ts` — the authenticated on-demand dashboard read for the caller:
  live metrics, benchmark comparison, and the latest stored AI report.
- `backend/scheduler/schedules.json` — `weekly-advertiser-ai-report`, Mondays 14:00 UTC.
- Settings (category *AI & Agents*): `AI_ADVERTISER_REPORTS_ENABLED` (master switch), `PPC_BENCH_*` benchmarks,
  `ADVERTISER_METRICS_MIN_IMPRESSIONS` / `ADVERTISER_METRICS_MIN_CLICKS` (substantiation thresholds).

## Gating

The whole feature is behind `AI_ADVERTISER_REPORTS_ENABLED` (default ON). Turning it off silences both the
weekly sweep and the on-demand read. Benchmarks and thresholds are admin-tunable so the "standard PPC" context
can be updated as norms shift, without code changes.
