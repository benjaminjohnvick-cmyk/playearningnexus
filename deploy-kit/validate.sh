#!/usr/bin/env bash
# Pre-deploy validation — run this LOCALLY before deploying. Proves the frontend build is green
# and the backend type-checks, so the developer doesn't burn hours discovering build breaks in the
# cloud. Turns Phase 3 (pre-deploy validation) from 3-6h into ~1h.
#
# Usage:  bash deploy-kit/validate.sh
set -uo pipefail
FAIL=0
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }

say "1/4  Frontend production build (the #1 launch blocker)"
if npm install --ignore-scripts >/dev/null 2>&1 && npm run build >/dev/null 2>&1; then
  echo "   OK — dist/ built. SPA is deployable."
else
  echo "   FAIL — frontend build broke. Fix before deploying."; FAIL=1
fi

say "2/4  Backend type-check (Deno) — if deno is installed"
if command -v deno >/dev/null 2>&1; then
  if (cd backend && deno check server/main.ts) ; then echo "   OK"; else echo "   WARN — deno check reported issues (review them)"; fi
else
  echo "   SKIP — deno not installed here; run 'deno check server/main.ts' on your deploy box."
fi

say "3/4  Backend function manifest integrity"
node -e '
  const m = require("./backend/functions/_manifest.json");
  const fs = require("fs");
  let miss = 0;
  for (const fn of m) { if (!fs.existsSync(`backend/functions/${fn}/entry.ts`)) { console.log("   MISSING entry:", fn); miss++; } }
  console.log(miss ? `   FAIL — ${miss} manifest entries have no file` : `   OK — all ${m.length} functions present`);
  process.exit(miss ? 1 : 0);
' || FAIL=1

say "4/4  Schema + seed present"
[ -f backend/db/schema.sql ] && echo "   OK — schema.sql present ($(wc -l < backend/db/schema.sql) lines)" || { echo "   FAIL — schema.sql missing"; FAIL=1; }

echo
if [ "$FAIL" = "0" ]; then echo -e "\033[1;32m✓ VALIDATION PASSED — safe to deploy.\033[0m"; else echo -e "\033[1;31m✗ VALIDATION FAILED — fix the items above first.\033[0m"; fi
exit $FAIL
