#!/usr/bin/env bash
# =============================================================================
#  GamerGain / PlayEarning Nexus — rebuild-from-scratch.sh
#  Reconstructs the ENTIRE RUNNING SITE from the source in this repo, from zero:
#  installs dependencies, brings up Postgres + the backend (the DB schema loads
#  itself and the backend auto-migrates), builds the frontend, and serves it.
#
#  It does NOT invent or regenerate code — the code in this repo IS the site.
#  This rebuilds a working local copy of the site from that source.
#
#  Prerequisites (install once, then keep Docker Desktop running):
#    • Node.js 18+     https://nodejs.org
#    • Docker Desktop  https://www.docker.com/products/docker-desktop
#
#  Run from the repo root:   bash deploy-kit/rebuild-from-scratch.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/5  Checking prerequisites"
command -v node   >/dev/null || { echo "!! Install Node.js first: https://nodejs.org"; exit 1; }
command -v docker >/dev/null || { echo "!! Install Docker Desktop and start it"; exit 1; }
docker info >/dev/null 2>&1   || { echo "!! Docker Desktop isn't running — start it, then re-run"; exit 1; }

echo "==> 2/5  Frontend dependencies + point the app at the local backend"
npm install
if ! grep -q "VITE_NEXUS_API_URL" .env.local 2>/dev/null; then
  echo "VITE_NEXUS_API_URL=http://localhost:8000" >> .env.local
fi

echo "==> 3/5  Backend env (created from the example if missing)"
[ -f backend/.env ] || cp backend/.env.example backend/.env
# NOTE: AI / payments / email need real keys in backend/.env — the site still boots without them.

echo "==> 4/5  Start Postgres + backend (schema auto-loads; backend auto-migrates)"
( cd backend && docker compose up --build -d db backend )
echo "    waiting for the backend to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then echo "    backend healthy ✓"; break; fi
  sleep 2
done

echo "==> 5/5  Build + serve the frontend"
npm run build
echo ""
echo "======================================================================"
echo "  Site rebuilt from scratch."
echo "    Backend API : http://localhost:8000   (health check: /health)"
echo "    Frontend    : http://localhost:4173   (starting now)"
echo "  Add real API keys to backend/.env to enable AI, payments, and email."
echo "  Stop the backend later with:  cd backend && docker compose down"
echo "======================================================================"
npm run preview -- --port 4173 --host
