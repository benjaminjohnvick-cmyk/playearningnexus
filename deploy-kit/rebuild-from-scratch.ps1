# =============================================================================
#  GamerGain / PlayEarning Nexus — rebuild-from-scratch.ps1  (Windows PowerShell)
#  Reconstructs the ENTIRE RUNNING SITE from the source in this repo, from zero:
#  installs dependencies, brings up Postgres + the backend (schema auto-loads,
#  backend auto-migrates), builds the frontend, and serves it.
#
#  It does NOT invent or regenerate code — the code in this repo IS the site.
#
#  Prerequisites (install once, keep Docker Desktop running):
#    • Node.js 18+     https://nodejs.org
#    • Docker Desktop  https://www.docker.com/products/docker-desktop
#
#  How to run (from the repo root, in PowerShell):
#    powershell -ExecutionPolicy Bypass -File deploy-kit\rebuild-from-scratch.ps1
# =============================================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> 1/5  Checking prerequisites"
if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { throw "Install Node.js first: https://nodejs.org" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Install Docker Desktop and start it" }
docker info *> $null; if ($LASTEXITCODE -ne 0) { throw "Docker Desktop isn't running — start it, then re-run" }

Write-Host "==> 2/5  Frontend dependencies + point the app at the local backend"
npm install
if (-not (Select-String -Path ".env.local" -Pattern "VITE_NEXUS_API_URL" -Quiet -ErrorAction SilentlyContinue)) {
  Add-Content ".env.local" "VITE_NEXUS_API_URL=http://localhost:8000"
}

Write-Host "==> 3/5  Backend env (created from the example if missing)"
if (-not (Test-Path "backend\.env")) { Copy-Item "backend\.env.example" "backend\.env" }
# NOTE: AI / payments / email need real keys in backend\.env — the site still boots without them.

Write-Host "==> 4/5  Start Postgres + backend (schema auto-loads; backend auto-migrates)"
Push-Location backend
docker compose up --build -d db backend
Pop-Location
Write-Host "    waiting for the backend to become healthy..."
for ($i = 0; $i -lt 30; $i++) {
  try { Invoke-WebRequest -UseBasicParsing "http://localhost:8000/health" -TimeoutSec 3 *> $null; Write-Host "    backend healthy"; break } catch { Start-Sleep 2 }
}

Write-Host "==> 5/5  Build + serve the frontend"
npm run build
Write-Host ""
Write-Host "======================================================================"
Write-Host "  Site rebuilt from scratch."
Write-Host "    Backend API : http://localhost:8000   (health check: /health)"
Write-Host "    Frontend    : http://localhost:4173   (starting now)"
Write-Host "  Add real API keys to backend\.env to enable AI, payments, and email."
Write-Host "  Stop the backend later with:  cd backend; docker compose down"
Write-Host "======================================================================"
npm run preview -- --port 4173 --host
