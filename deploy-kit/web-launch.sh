#!/usr/bin/env bash
# ==============================================================================
#  web-launch.sh — THE single-command WEB launch (the true floor).
#
#  One command takes you from "code + keys" to "web app live, on, and full of
#  content," by chaining the pieces the kit already ships:
#     1) railway-deploy.sh  → provision Postgres + deploy the single service
#     2) go-live.mjs        → verify every flag is ON, pre-warm the catalog,
#                             smoke-test, and print GO / NO-GO
#     3) prints the two owner flips that open the doors
#
#  This is the cheapest path to live: it skips the native-app phases (store
#  signing, upload, and Apple/Google review) — add those later with the mobile
#  kit; nothing here has to be redone.
#
#  Prereqs (one-time, owner):
#     - npm i -g @railway/cli   &&   railway login
#     - fill backend/.env  (see API-KEYS-WORKSHEET.md); include ADMIN_EMAIL /
#       ADMIN_PASSWORD of your admin account so go-live can pre-warm content.
#
#  Run from the repo root:   bash deploy-kit/web-launch.sh
# ==============================================================================
set -uo pipefail
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
ok(){  printf "   \033[1;32m[OK] %s\033[0m\n" "$1"; }
doo(){ printf "   \033[1;33m[DO] %s\033[0m\n" "$1"; }
err(){ printf "   \033[1;31m[!!] %s\033[0m\n" "$1"; }
ENVFILE="${1:-backend/.env}"

say "WEB LAUNCH — the one-command floor path"
[ -f "$ENVFILE" ] || { err "no $ENVFILE — copy backend/.env.example, add your keys, then re-run."; exit 1; }
# Load env so we can read BACKEND_URL / ADMIN creds after deploy.
set -a; . "$ENVFILE" 2>/dev/null || true; set +a

# ── 1. Deploy (provision + push env + up) ─────────────────────────────────────
say "STEP 1/3  Deploy the single service to Railway"
if command -v railway >/dev/null 2>&1; then
  bash deploy-kit/railway/railway-deploy.sh "$ENVFILE" || { err "deploy failed — check 'railway logs' and re-run."; exit 1; }
  # Try to capture the public URL the CLI just generated.
  DOMAIN="$(railway domain 2>/dev/null | grep -oE 'https?://[a-zA-Z0-9.-]+' | head -1 || true)"
  [ -n "${DOMAIN:-}" ] && { BACKEND_URL="$DOMAIN"; ok "backend URL: $BACKEND_URL"; }
else
  doo "Railway CLI not found. Easiest no-terminal path: click the 'Deploy on Railway' button in the README,"
  doo "add a Postgres database, set Root Directory = backend, paste your keys. Then set BACKEND_URL and re-run."
fi

# ── 2. Go-live pre-warm (flags ON + content live + smoke + GO/NO-GO) ──────────
say "STEP 2/3  Go-live pre-warm & readiness"
if [ -z "${BACKEND_URL:-}" ]; then
  doo "BACKEND_URL not set yet — once the deploy shows your URL, run:"
  doo "  BACKEND_URL=<your-url> ADMIN_EMAIL=… ADMIN_PASSWORD=… node deploy-kit/go-live.mjs"
elif command -v node >/dev/null 2>&1; then
  BACKEND_URL="$BACKEND_URL" ADMIN_EMAIL="${ADMIN_EMAIL:-}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
    node deploy-kit/go-live.mjs || doo "go-live flagged items to resolve before opening (see above)."
else
  doo "node not found — run go-live.mjs on a machine with Node 18+."
fi

# ── 3. The doors ──────────────────────────────────────────────────────────────
say "STEP 3/3  Open the doors (owner, one line each)"
echo "   1. (optional) Payments live: set Stripe/PayPal live keys. Closed-loop needs NONE of this to launch —"
echo "      card_charging / cash_out stay OFF until a merchant account + counsel are ready."
echo "   2. Open the site: turn MAINTENANCE_MODE OFF in the admin panel so the public can sign up."
echo
ok "Web is your launch. Add Android/iOS later with ANDROID-SUBMISSION-KIT.md / IOS-NO-MAC-KIT.md — no rework."
