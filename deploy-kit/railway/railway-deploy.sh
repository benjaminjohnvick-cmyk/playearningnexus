#!/usr/bin/env bash
# railway-deploy.sh — provision + deploy on Railway from the command line, so most of the
# dashboard clicking is automated. Sets your backend env vars from backend/.env and deploys.
#
# Prereqs (one-time, by you):
#   1) Install the Railway CLI:   npm i -g @railway/cli
#   2) Log in:                    railway login        (opens the browser once)
#   3) Fill in backend/.env with your keys (see API-KEYS-WORKSHEET.md)
#
# Run from the repo root:   bash deploy-kit/railway/railway-deploy.sh
set -uo pipefail
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
ENVFILE="${1:-backend/.env}"

command -v railway >/dev/null 2>&1 || { echo "Railway CLI not found. Install:  npm i -g @railway/cli"; exit 1; }

say "1/5  Link or create a Railway project"
railway status >/dev/null 2>&1 || railway init      # interactive the first time

say "2/5  Add a PostgreSQL database (skips if one exists)"
railway add --database postgres 2>/dev/null || echo "   (postgres may already be attached — continuing)"

say "3/5  Push your env vars from $ENVFILE"
if [ -f "$ENVFILE" ]; then
  # Feed each KEY=VALUE line to Railway. DATABASE_URL is provided by the Postgres plugin, so skip it.
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue;; esac
    key="${line%%=*}"
    [ "$key" = "DATABASE_URL" ] && continue
    railway variables set "$line" >/dev/null 2>&1 && echo "   set $key" || echo "   ! could not set $key"
  done < "$ENVFILE"
  # Recommended single-service flags (serve frontend + inline scheduler + auto-migrate)
  railway variables set "AUTO_MIGRATE=1" "SCHEDULER_INLINE=1" "FRONTEND_DIR=./public" >/dev/null 2>&1 || true
  echo "   set single-service flags (AUTO_MIGRATE, SCHEDULER_INLINE, FRONTEND_DIR)"
else
  echo "   ! $ENVFILE not found — fill it in first (API-KEYS-WORKSHEET.md)"
fi

say "4/5  Deploy the backend"
( cd backend && railway up --detach ) || { echo "   deploy failed — check 'railway logs'"; exit 1; }

say "5/5  Get the public URL"
railway domain 2>/dev/null || echo "   run 'railway domain' to generate/print the URL"

echo
echo "Done. Notes:"
echo "  • Single-service mode is on (backend serves the built frontend + runs the scheduler inline)."
echo "    Build the frontend and copy dist/ into backend/public before deploy:  npm run build && cp -r dist backend/public"
echo "  • The schema auto-loads on first boot (AUTO_MIGRATE=1)."
echo "  • Verify:  curl https://<your-domain>/health"
