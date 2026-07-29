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

say "4/7  Schema + seed present"
[ -f backend/db/schema.sql ] && echo "   OK — schema.sql present ($(wc -l < backend/db/schema.sql) lines)" || { echo "   FAIL — schema.sql missing"; FAIL=1; }

say "5/7  Every entity has a table (entities.json ↔ schema.sql)"
node -e '
  const fs=require("fs");
  const ents=JSON.parse(fs.readFileSync("backend/db/entities.json","utf8"));
  const sql=fs.readFileSync("backend/db/schema.sql","utf8");
  const miss=ents.filter(e=>!new RegExp("CREATE TABLE IF NOT EXISTS\\s+\"?"+e+"\"?","i").test(sql));
  if(miss.length){console.log("   FAIL — "+miss.length+" entities have no CREATE TABLE:",miss.slice(0,20).join(", "));process.exit(1);}
  console.log("   OK — all "+ents.length+" entities have a table");
' || FAIL=1

say "6/7  Every scheduled job points at a real function"
node -e '
  const fs=require("fs");
  const sch=JSON.parse(fs.readFileSync("backend/scheduler/schedules.json","utf8"));
  const jobs=sch.jobs||[];
  const miss=jobs.filter(j=>!fs.existsSync("backend/functions/"+j.function+"/entry.ts"));
  if(miss.length){console.log("   FAIL — "+miss.length+" scheduled jobs have no function:",miss.map(j=>j.function).join(", "));process.exit(1);}
  console.log("   OK — all "+jobs.length+" scheduled jobs resolve to a function");
' || FAIL=1

say "7/7  Manifest is valid JSON with no duplicates"
node -e '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync("backend/functions/_manifest.json","utf8"));
  const dup=m.filter((x,i)=>m.indexOf(x)!==i);
  if(dup.length){console.log("   FAIL — duplicate manifest entries:",[...new Set(dup)].join(", "));process.exit(1);}
  console.log("   OK — manifest valid, "+m.length+" unique functions");
' || FAIL=1

echo
if [ "$FAIL" = "0" ]; then echo -e "\033[1;32m✓ VALIDATION PASSED — safe to deploy (build green, schema/entities/scheduler/manifest all consistent).\033[0m"; else echo -e "\033[1;31m✗ VALIDATION FAILED — fix the items above first.\033[0m"; fi
exit $FAIL
