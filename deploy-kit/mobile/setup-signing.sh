#!/usr/bin/env bash
# ==============================================================================
#  setup-signing.sh — one command that removes the fiddliest mobile step:
#  producing the Android upload keystore AND the exact CI secret values to paste.
#
#  It generates the keystore (no Android Studio), base64-encodes it, and writes a
#  ready-to-paste secrets file listing every GitHub Actions secret name with its
#  value (Android filled in; iOS/Play labeled with where each value comes from).
#  This turns "figure out keytool + base64 + which secret names" (hours of
#  discovery) into a couple of minutes.
#
#  Run from the repo root:   bash deploy-kit/mobile/setup-signing.sh
#  Prereqs: a JDK (keytool) and base64 — both standard on any build machine.
# ==============================================================================
set -uo pipefail
say(){ printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
ok(){  printf "   \033[1;32m[OK] %s\033[0m\n" "$1"; }
doo(){ printf "   \033[1;33m[DO] %s\033[0m\n" "$1"; }

OUT_DIR="deploy-kit/mobile"
KS="$OUT_DIR/upload.keystore"                 # *.keystore is gitignored
SECRETS="$OUT_DIR/ci-secrets.local.txt"       # ci-secrets* is gitignored (added below)

command -v keytool >/dev/null 2>&1 || { echo "keytool not found — install a JDK (e.g. Temurin) and re-run."; exit 1; }
command -v base64  >/dev/null 2>&1 || { echo "base64 not found."; exit 1; }

say "1/3  Generate the Android upload keystore"
if [ -f "$KS" ]; then
  ok "keystore already exists at $KS (reusing — NEVER regenerate for an existing app)"
  KPASS="${ANDROID_KEYSTORE_PASSWORD:-<the password you set when you created it>}"
else
  KPASS="${ANDROID_KEYSTORE_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)}"
  keytool -genkeypair -v -keystore "$KS" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KPASS" -keypass "$KPASS" \
    -dname "CN=GamerGain, OU=Mobile, O=GamerGain, L=, S=, C=US" >/dev/null 2>&1 \
    && ok "created $KS (alias: upload)" || { echo "keystore generation failed"; exit 1; }
  doo "BACK UP $KS and this password somewhere safe — the SAME key must sign every future update."
fi

say "2/3  Write the ready-to-paste CI secrets file"
KB64="$(base64 -w0 "$KS" 2>/dev/null || base64 -b0 "$KS" 2>/dev/null || base64 "$KS" | tr -d '\n')"
{
  echo "# ── Paste each of these into GitHub → Settings → Secrets and variables → Actions ──"
  echo "# (Android values are filled in below. Fill the Play + iOS ones from your consoles.)"
  echo
  echo "ANDROID_KEYSTORE_BASE64=$KB64"
  echo "ANDROID_KEYSTORE_PASSWORD=$KPASS"
  echo "ANDROID_KEY_ALIAS=upload"
  echo "ANDROID_KEY_PASSWORD=$KPASS"
  echo
  echo "# Google Play (from a Play service-account JSON — Play Console → API access):"
  echo "PLAY_SERVICE_ACCOUNT_JSON=<paste the full service-account JSON>"
  echo
  echo "# Apple App Store Connect API key (Users and Access → Integrations → App Store Connect API):"
  echo "APPSTORE_API_KEY_ID=<Key ID>"
  echo "APPSTORE_API_ISSUER_ID=<Issuer ID>"
  echo "APPSTORE_API_KEY_P8=<paste the contents of the downloaded .p8 file>"
} > "$SECRETS"
ok "wrote $SECRETS (gitignored — do NOT commit it)"

say "3/3  Next"
doo "1) Open $SECRETS and paste each line into GitHub Actions secrets."
doo "2) Fill PLAY_SERVICE_ACCOUNT_JSON and the three APPSTORE_* values from your Play/Apple consoles."
doo "3) Push to 'android-release' / 'ios-release' (or run the Actions jobs) — CI signs + uploads via fastlane."
echo
ok "Signing setup done. Reviewer notes are pre-written in deploy-kit/REVIEWER-NOTES.md — paste them at submission."
