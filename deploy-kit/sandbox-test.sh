#!/usr/bin/env bash
# ============================================================================
#  deploy-kit/sandbox-test.sh — ONE command: spin up the sandbox with mock data,
#  then run the full functional error-catch (API smoke + browser walkthrough),
#  then report. This is the "no-AI, anyone-can-launch" version of the procedure.
#
#  Usage:  bash deploy-kit/sandbox-test.sh            # up, test, leave running
#          bash deploy-kit/sandbox-test.sh --down     # ...and tear down after
#
#  What it catches: broken pages, server 500s, uncaught JS/console errors, React
#  error boundaries, and failing critical API flows — across every route, logged
#  in as the demo user. It FINDS issues (with screenshots + a JSON report); it
#  does NOT auto-fix (that needs judgment — a human or a reviewed AI pass).
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.." # repo root
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
FAIL=0

say "1/4  Bring up the sandbox (mock data)"
bash deploy-kit/sandbox.sh || { echo "sandbox failed to start"; exit 1; }

say "2/4  API critical-path smoke (signup→survey→store→payout→PPC→ads→boost)"
if command -v node >/dev/null 2>&1; then
  BACKEND_URL=http://localhost:8000 SMOKE_STAMP="$(date +%s 2>/dev/null || echo run)" node deploy-kit/e2e-smoke.mjs || FAIL=1
fi

say "3/4  Browser walkthrough (act like a user across every route)"
if [ ! -d node_modules/playwright ]; then
  echo "   installing Playwright (one-time)…"; npm i -D playwright >/dev/null 2>&1 || echo "   couldn't auto-install Playwright — run: npm i -D playwright"
fi
APP_URL=http://localhost:4173 node deploy-kit/e2e/walkthrough.mjs || FAIL=1

say "4/4  Result"
if [ "$FAIL" = "0" ]; then echo -e "\033[1;32m✓ Sandbox walkthrough clean — no hard errors found.\033[0m"
else echo -e "\033[1;33m! Issues found — see the log above + deploy-kit/e2e/artifacts/. Fix, then re-run.\033[0m"; fi

if [ "${1:-}" = "--down" ]; then bash deploy-kit/sandbox.sh --down; fi
exit $FAIL
