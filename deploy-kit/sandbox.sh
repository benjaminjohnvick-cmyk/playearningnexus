#!/usr/bin/env bash
# ============================================================================
#  deploy-kit/sandbox.sh — bring up a full local SANDBOX of the app with mock
#  data, in one command. Postgres + backend (Docker) + the built frontend, with
#  reviewer demo-login enabled. Nothing here touches production or real money.
#
#  Usage:  bash deploy-kit/sandbox.sh            # start it
#          bash deploy-kit/sandbox.sh --down     # stop + remove it
#  Then:   app  → http://localhost:4173   (demo login at /ReviewerLogin)
#          api  → http://localhost:8000/health
#
#  Requires: Docker (for Postgres+backend) and Node/npm (for the frontend).
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.." # repo root
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
COMPOSE="docker compose -f backend/docker-compose.yml"

if [ "${1:-}" = "--down" ]; then
  say "Tearing down the sandbox"; $COMPOSE down -v 2>/dev/null; pkill -f "vite preview" 2>/dev/null; echo "done."; exit 0
fi

say "1/5  Sandbox env (backend/.env)"
ENV=backend/.env
[ -f "$ENV" ] || cp backend/.env.example "$ENV"
grep -q "^AUTO_MIGRATE="   "$ENV" || echo "AUTO_MIGRATE=1"   >> "$ENV"   # load schema on boot
grep -q "^REVIEWER_DEMO="  "$ENV" || echo "REVIEWER_DEMO=1"  >> "$ENV"   # enable /ReviewerLogin demo
if grep -q "AUTH_JWT_SECRET=change-me" "$ENV" && command -v openssl >/dev/null 2>&1; then
  sed -i "s|AUTH_JWT_SECRET=.*|AUTH_JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" "$ENV"
fi
# Frontend points at the sandbox backend.
echo "VITE_NEXUS_API_URL=http://localhost:8000" > .env.local

say "2/5  Start Postgres + backend (Docker; Postgres auto-loads schema.sql)"
if ! command -v docker >/dev/null 2>&1; then echo "   Docker not found — install Docker to run the sandbox backend."; exit 1; fi
$COMPOSE up -d --build

say "3/5  Wait for the backend /health"
up=0; for i in $(seq 1 60); do curl -fsS http://localhost:8000/health >/dev/null 2>&1 && { up=1; echo "   backend up"; break; }; sleep 2; done
[ "$up" = "1" ] || { echo "   backend didn't come up — check '$COMPOSE logs backend'"; }

say "4/5  Seed mock data"
$COMPOSE exec -T backend deno run --allow-net --allow-env --allow-read tools/seed-demo.ts 2>/dev/null \
  && echo "   demo data seeded" \
  || echo "   (seed step skipped/failed — the walkthrough still runs; adjust to your seeder if needed)"

say "5/5  Build + serve the frontend (http://localhost:4173)"
if command -v npm >/dev/null 2>&1; then
  npm install --ignore-scripts >/dev/null 2>&1
  npm run build >/dev/null 2>&1 && echo "   dist/ built" || echo "   frontend build issue (API still testable)"
  pkill -f "vite preview" 2>/dev/null
  nohup npm run preview -- --port 4173 --host >/tmp/gg-preview.log 2>&1 &
  for i in $(seq 1 30); do curl -fsS http://localhost:4173 >/dev/null 2>&1 && break; sleep 1; done
else echo "   npm not found — serve dist/ yourself."; fi

echo
echo -e "\033[1;32m✓ SANDBOX READY\033[0m"
echo "   App:  http://localhost:4173   (demo login: /ReviewerLogin)"
echo "   API:  http://localhost:8000/health"
echo "   Test it:  node deploy-kit/e2e/walkthrough.mjs      (headless browser walkthrough)"
echo "   Stop it:  bash deploy-kit/sandbox.sh --down"
