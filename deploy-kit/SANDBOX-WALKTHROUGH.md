# Sandbox Walkthrough — functional error-catching (with and without an AI)

Part of the kit's error-catching layer (alongside `CODE-AUDITOR.md`). This spins up a **real, throwaway
copy of the whole site with mock data** and then **acts like a user across every screen** to catch the
functional errors a person would hit — broken pages, server 500s, uncaught JS/console errors, React error
boundaries, and failing critical flows. Nothing here touches production or real money.

There are two versions. The **standalone** one needs no AI and anyone can launch it. The **AI-driven** one
is the upgrade when a Claude session + the Chrome extension are connected.

## A. Standalone — one command, no AI (in the kit)

```
bash deploy-kit/sandbox-test.sh          # spin up sandbox + run the full walkthrough
bash deploy-kit/sandbox-test.sh --down   # ...and tear it down after
```

What it does, in order:
1. **`sandbox.sh`** — brings up a local sandbox: Postgres + the backend (Docker; Postgres auto-loads
   `schema.sql`), seeds mock data (`tools/seed-demo.ts`), enables the demo login (`REVIEWER_DEMO=1`), and
   builds + serves the frontend. App at `http://localhost:4173`, API at `http://localhost:8000`.
2. **`e2e-smoke.mjs`** — the API critical-path smoke (signup → survey → store → payout → PPC → ads → boost).
3. **`e2e/walkthrough.mjs`** — a **headless browser logs in as the demo user and visits EVERY app route**
   (extracted straight from `src/App.jsx`, the router = source of truth — ~166 routes). For each route it
   captures: uncaught JS / console errors, server 5xx responses, and React error-boundary crashes; it
   **screenshots every failure** and writes `deploy-kit/e2e/artifacts/walkthrough-report.json`.

Prereqs: Docker + Node, and Playwright (`npm i -D playwright`, browsers download once). Exit code is
non-zero if anything failed, so it drops straight into CI.

**Honest scope:** this **FINDS** issues — deterministically, no AI. It does **not auto-fix** them; fixing
is judgment work (a human, or a *reviewed* AI pass), same line the code auditor holds. And a browser crawl
exercises **user-facing routes**, not literally all 643 backend functions — the scheduled/agent/backend-only
functions are covered by the API smoke, not the click-through. So it's "every screen + every critical API
flow," not a proof of total correctness (nothing is — see CODE-AUDITOR.md).

## B. AI-driven — Claude walks the site and fixes what it finds (the upgrade)

When an agentic session is running **and** the Chrome extension is connected to a browser that can reach a
running sandbox, Claude can do what a script can't: exercise flows **with judgment**, fill forms as a real
user, switch between roles (user / seller / admin / developer via the demo logins), notice things that
aren't hard errors (a confusing state, a wrong total, a flow that "works" but does the wrong thing), and
then **edit the code to fix them** and re-test. That's the version you asked about — it's real, but it has
honest requirements:
- a **running sandbox the Chrome extension can reach** (the extension drives a browser on your machine, so
  the sandbox needs to be running locally or at a URL that browser can open — a cloud shell's localhost is
  not reachable by your Chrome),
- an **active Claude session** with the Chrome tools, and
- the same money/compliance guardrail: fixes to money/logic get reviewed, not blind-applied.

The standalone version (A) is what's baked into the kit so it runs for everyone, every time, with no AI.
The AI version (B) is when you want the judgment + auto-fix pass on top — you point Claude at the sandbox
from (A) and say "walk the site as each role and fix what's broken."

## Files
- `deploy-kit/sandbox.sh` — bring up / tear down the sandbox with mock data.
- `deploy-kit/e2e/walkthrough.mjs` — the headless browser route walkthrough.
- `deploy-kit/sandbox-test.sh` — one-command orchestration (sandbox → API smoke → walkthrough → report).
- Artifacts (screenshots + JSON report) land in `deploy-kit/e2e/artifacts/` (git-ignored).
