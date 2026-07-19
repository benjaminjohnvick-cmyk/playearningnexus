#!/usr/bin/env bash
# Regenerate the native Android/iOS shells FROM the wrapper, on demand.
#
# The repo is wrapper-only: android/ and ios/ are NOT committed (see .gitignore).
# This script recreates them from capacitor.config.json + the web build whenever
# you need to produce a native app, then keeps them in sync. Run it before
# opening Android Studio / Xcode. iOS steps only run on macOS.
set -e

echo "▶ Building the web app…"
npm run build

echo "▶ Generating app icons/splash (if assets/icon.png exists)…"
if [ -f "assets/icon.png" ]; then
  npm run cap:assets || echo "  (asset generation skipped)"
fi

echo "▶ Ensuring Android platform…"
if [ ! -d "android" ]; then
  npx cap add android
else
  echo "  android/ already present (regenerating is optional)"
fi

# iOS can only be generated/built on macOS.
if [ "$(uname)" = "Darwin" ]; then
  echo "▶ Ensuring iOS platform…"
  if [ ! -d "ios" ]; then
    npx cap add ios
  else
    echo "  ios/ already present"
  fi
else
  echo "▶ Skipping iOS (requires macOS + Xcode)."
fi

echo "▶ Syncing web build + plugins into native shells…"
npx cap sync

echo "✓ Done. Open with: npm run cap:open:android   (and, on a Mac) npm run cap:open:ios"
echo "  Note: android/ and ios/ are git-ignored — they are build artifacts, not source."
