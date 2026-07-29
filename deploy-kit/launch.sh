#!/usr/bin/env bash
# ==============================================================================
#  GamerGain / PlayEarning Nexus — launch.sh
#  Runs the AUTOMATABLE parts of the execution kit, in order.
#
#  It does the machine work: checks your keys, generates the secrets that can be
#  auto-made, validates the build, loads the database schema, and smoke-tests the
#  backend. It then tells you the human steps it CANNOT do (create accounts, click
#  through your host's dashboard, pass app-store review).
#
#  BEFORE running: fill in  backend/.env  with your keys (see API-KEYS-WORKSHEET.md).
#  Run from the repo root:   bash deploy-kit/launch.sh
# ==============================================================================
set -uo pipefail
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
ok(){  printf "   \033[1;32m[OK] %s\033[0m\n" "$1"; }
warn(){ printf "   \033[1;33m[DO] %s\033[0m\n" "$1"; }
err(){ printf "   \033[1;31m[!!] %s\033[0m\n" "$1"; }

ENVFILE="${1:-backend/.env}"
TODO=()

# ---- STEP 1: keys file -------------------------------------------------------
say "STEP 1/6  Check your keys file ($ENVFILE)"
if [ -f "$ENVFILE" ]; then
  set -a; . "$ENVFILE" 2>/dev/null || true; set +a
  ok "loaded $ENVFILE"
else
  err "no $ENVFILE found."
  if [ -f backend/.env.example ]; then cp backend/.env.example "$ENVFILE"; warn "created $ENVFILE from the example — open it and paste your keys, then re-run."; else warn "create $ENVFILE and add your keys (see API-KEYS-WORKSHEET.md)"; fi
  TODO+=("Fill in $ENVFILE with your API keys, then run this again.")
fi
MISSING=""
for v in DATABASE_URL AUTH_JWT_SECRET OPENAI_API_KEY SENDGRID_API_KEY; do
  eval "val=\${$v:-}"; [ -z "${val:-}" ] && MISSING="$MISSING $v"
done
[ -n "$MISSING" ] && { warn "still missing:$MISSING"; } || ok "core keys present"

# ---- STEP 2: auto-generate secrets ------------------------------------------
say "STEP 2/6  Auto-generate the secrets you can't get from a provider"
if [ -z "${AUTH_JWT_SECRET:-}" ] && command -v openssl >/dev/null 2>&1; then
  GEN=$(openssl rand -base64 48 | tr -d '\n'); printf '\nAUTH_JWT_SECRET=%s\n' "$GEN" >> "$ENVFILE"; ok "generated AUTH_JWT_SECRET (written to $ENVFILE)"
else
  [ -n "${AUTH_JWT_SECRET:-}" ] && ok "AUTH_JWT_SECRET already set" || warn "install openssl or set AUTH_JWT_SECRET manually (any long random string)"
fi
if [ -z "${VAPID_PUBLIC_KEY:-}" ] && command -v npx >/dev/null 2>&1; then
  warn "web-push VAPID keys not set — generate once with:  npx web-push generate-vapid-keys"
fi

# ---- STEP 3: validate the build ---------------------------------------------
say "STEP 3/6  Validate the build (the #1 thing that breaks deploys)"
if command -v npm >/dev/null 2>&1; then
  if npm install --ignore-scripts >/dev/null 2>&1 && npm run build >/dev/null 2>&1; then ok "frontend build is green — deployable"; else err "frontend build FAILED — run 'npm run build' to see why"; TODO+=("Fix the frontend build (npm run build) before deploying."); fi
else warn "npm not found here — run this on a machine with Node installed"; fi
# Automated code auditor: structural checks (fail) + guardrail lints (advisory).
if command -v node >/dev/null 2>&1; then
  if node deploy-kit/audit.mjs; then ok "code auditor: structural checks passed"; else err "code auditor found structural errors (see above)"; TODO+=("Fix the auditor's structural errors before deploying."); fi
fi

# ---- STEP 4: load the database schema ---------------------------------------
say "STEP 4/6  Load the database schema"
if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  if psql "$DATABASE_URL" -f backend/db/schema.sql >/dev/null 2>&1; then ok "schema loaded into your database"; else err "schema load failed — check DATABASE_URL"; TODO+=("Load backend/db/schema.sql into your database."); fi
else
  warn "psql not available or DATABASE_URL not set."
  warn "Easiest: paste the contents of backend/db/schema.sql into your host's SQL console (Railway → Postgres → Data → Query), OR let 'docker compose up' load it automatically."
  TODO+=("Load backend/db/schema.sql once, via your host's SQL console.")
fi

# ---- STEP 5: smoke-test the backend (automated QA) --------------------------
say "STEP 5/6  Smoke-test the backend (automated QA — replaces the manual click-through)"
if [ -n "${BACKEND_URL:-}" ] && command -v curl >/dev/null 2>&1; then
  if curl -fsS "${BACKEND_URL%/}/health" >/dev/null 2>&1; then
    ok "backend /health responded OK at $BACKEND_URL"
    # Run the full critical-path + new-feature QA automatically (signup→survey→store→payout→PPC→ads→boost).
    if command -v node >/dev/null 2>&1; then
      say "     Running automated QA pass (deploy-kit/e2e-smoke.mjs)…"
      if BACKEND_URL="$BACKEND_URL" SMOKE_STAMP="$(date +%s 2>/dev/null || echo run)" node deploy-kit/e2e-smoke.mjs; then
        ok "automated QA pass GREEN — critical path + new features all responded"
      else
        err "automated QA found failing endpoints (see above) — fix before submitting to stores"; TODO+=("Fix the endpoints the QA smoke flagged, then re-run.")
      fi
    else
      warn "node not found — run 'BACKEND_URL=$BACKEND_URL node deploy-kit/e2e-smoke.mjs' on a machine with Node"
    fi
  else
    warn "backend not reachable at ${BACKEND_URL%/}/health yet — deploy it first (Step 3 of the step-by-step)"
  fi
else
  warn "set BACKEND_URL in $ENVFILE to auto-run the QA smoke once the backend is deployed"
fi

# ---- STEP 6: trigger the mobile app builds ----------------------------------
say "STEP 6/6  Build the mobile apps (CI)"
warn "The Android/iOS builds run in the cloud via the workflows already in your repo."
warn "In GitHub → the ACTIONS tab → run 'Android Build & Play' and 'iOS Build & TestFlight'."
warn "(They need your signing secrets set first — see ANDROID-SUBMISSION-KIT.md / IOS-NO-MAC-KIT.md.)"

# ---- Summary ----------------------------------------------------------------
say "SUMMARY — what the script did, and what only YOU can do next"
echo "   The script handled the machine work above. The steps below are yours"
echo "   (a program can't create your accounts, click your host's dashboard, or"
echo "   pass Apple/Google's review):"
echo
echo "   • Create the accounts + get the keys        (see LAUNCH-STEP-BY-STEP, Phase 0-1)"
echo "   • Deploy on Railway's dashboard             (see railway/RAILWAY-DEPLOY.md)"
echo "   • Submit the apps + pass store review       (see the submission kits)"
echo "   • Legal review of privacy/terms             (in parallel)"
if [ ${#TODO[@]} -gt 0 ]; then
  echo; echo "   Items this run flagged for you:"; for t in "${TODO[@]}"; do echo "     - $t"; done
fi
echo
echo "   Full ordered plan:  LAUNCH-STEP-BY-STEP.md"
