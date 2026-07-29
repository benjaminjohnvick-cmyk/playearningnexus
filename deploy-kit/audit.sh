#!/usr/bin/env bash
# deploy-kit/audit.sh — run the automated code auditor + the real compilers, and (optionally) apply the
# SAFE mechanical auto-fixes. Honest split:
#   • FINDS (always): structural checks + guardrail lints (audit.mjs), Deno type-check, ESLint.
#   • AUTO-FIXES (only with --fix): formatting + lint autofix. NEVER money/logic — those are reported
#     for human/AI review on purpose. A tool silently rewriting payout math is how you lose money.
#
# Usage:
#   bash deploy-kit/audit.sh            # find only (fails on structural errors)
#   bash deploy-kit/audit.sh --fix      # also apply safe formatting/lint autofixes
#   bash deploy-kit/audit.sh --strict   # also fail on advisory guardrail warnings
set -uo pipefail
FIX=0; STRICT=""
for a in "$@"; do [ "$a" = "--fix" ] && FIX=1; [ "$a" = "--strict" ] && STRICT="--strict"; done
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
FAIL=0

say "1/4  Automated auditor (structural + guardrail lints)"
if command -v node >/dev/null 2>&1; then node deploy-kit/audit.mjs $STRICT || FAIL=1; else echo "   node not found — install Node 18+"; FAIL=1; fi

say "2/4  Deno type-check (real compiler — authoritative syntax/type errors)"
if command -v deno >/dev/null 2>&1; then
  (cd backend && deno check server/main.ts) || { echo "   deno check reported errors above"; FAIL=1; }
else echo "   SKIP — deno not installed; run 'cd backend && deno check server/main.ts' on your box."; fi

say "3/4  Frontend build + ESLint"
if command -v npm >/dev/null 2>&1; then
  npm install --ignore-scripts >/dev/null 2>&1
  if [ "$FIX" = "1" ]; then npm run lint:fix >/dev/null 2>&1 && echo "   ESLint --fix applied (safe autofixes)"; fi
  npm run build >/dev/null 2>&1 && echo "   frontend build OK" || { echo "   frontend build FAILED"; FAIL=1; }
else echo "   SKIP — npm not found."; fi

say "4/4  Safe auto-fix (formatting)"
if [ "$FIX" = "1" ]; then
  command -v deno >/dev/null 2>&1 && deno fmt backend/ >/dev/null 2>&1 && echo "   deno fmt applied to backend/"
  echo "   NOTE: logic / money / compliance issues are NOT auto-fixed — see the auditor warnings above and"
  echo "         FULL-CODE-AUDIT-*.md. Fix those by hand or with a reviewed AI pass."
else
  echo "   (skipped — run with --fix to apply formatting/lint autofixes)"
fi

echo
[ "$FAIL" = "0" ] && echo -e "\033[1;32m✓ AUDIT CLEAN (structural).\033[0m" || echo -e "\033[1;31m✗ AUDIT found blocking issues — see above.\033[0m"
exit $FAIL
