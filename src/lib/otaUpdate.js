// Over-the-air (OTA) live updates for the native wrappers.
//
// GamerGain is a React web app inside a Capacitor shell, so ~all of the app's code is a WEB BUNDLE
// (JS/HTML/CSS). OTA pushes an updated web bundle straight to INSTALLED native apps — the native shell
// is unchanged, so there's NO App Store / Play review for web-layer changes. Users pick up the new
// bundle on next app open/login; there's no downtime. Only genuinely-new NATIVE code (a new plugin, a
// new OS permission) still needs a store release.
//
// Policy note: Apple (guideline 3.3.2) and Google allow updating the interpreted web/JS layer as long
// as it doesn't change the app's core purpose or bypass review — bug fixes, UI changes, and A/B
// variants are exactly what this is for, not shipping a different app.
//
// This module is a GUARDED integration of the open-source @capgo/capacitor-updater plugin. If the
// plugin isn't installed (or we're on plain web/PWA, which never needs OTA), every call no-ops. To go
// live: `npm i @capgo/capacitor-updater`, set the update channel/URL via the Capgo CLI (self-host or
// their cloud), and rebuild the native apps ONCE. After that, `npx @capgo/cli bundle upload` ships web
// changes with no store submission. See MOBILE-OTA-LIVE-UPDATES.md.

import { Capacitor } from '@capacitor/core';

let _inited = false;

async function loadUpdater() {
  try {
    // Dynamic import so the build succeeds even when the plugin isn't installed yet.
    const mod = await import(/* @vite-ignore */ '@capgo/capacitor-updater').catch(() => null);
    return mod?.CapacitorUpdater || null;
  } catch { return null; }
}

/** Initialize OTA on native only. Tells the plugin the web layer booted OK (so it won't roll back a
 *  good update) and checks for a newer bundle in the background. Safe/no-op on web or without the plugin. */
export async function initOta() {
  if (_inited) return;
  _inited = true;
  if (!Capacitor?.isNativePlatform?.()) return; // PWA/web always has the latest — nothing to do
  const Updater = await loadUpdater();
  if (!Updater) return; // plugin not installed → OTA simply inactive, app works normally
  try {
    await Updater.notifyAppReady?.();       // confirm this bundle is healthy
    await Updater.getLatest?.().catch(() => null);
    // With autoUpdate enabled in capacitor.config, the plugin downloads + applies on next launch.
  } catch { /* OTA is best-effort; never block the app */ }
}

/** Ask the plugin to check for a newer bundle now (e.g. on app resume/login). Applied on next open. */
export async function checkForOtaUpdate() {
  if (!Capacitor?.isNativePlatform?.()) return;
  const Updater = await loadUpdater();
  if (!Updater) return;
  try { await Updater.getLatest?.(); } catch { /* best-effort */ }
}
