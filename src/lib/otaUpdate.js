// Over-the-air (OTA) live updates for the native wrappers.
//
// Get Goods Gratis (Free) is a React web app inside a Capacitor shell, so ~all of the app's code is a WEB BUNDLE
// (JS/HTML/CSS). OTA pushes an updated web bundle straight to INSTALLED native apps — the native shell
// is unchanged, so there's NO App Store / Play review for web-layer changes. Users pick up the new
// bundle on next app open/login; there's no downtime. Only genuinely-new NATIVE code (a new plugin, a
// new OS permission) still needs a store release.
//
// COMPLIANCE / CONTROL (Apple guideline 3.3.2, Google policy): updating the interpreted web/JS layer is
// allowed as long as it doesn't change the app's core purpose or bypass review — bug fixes, UI changes, and
// A/B variants only. To keep that enforceable, OTA here is SERVER-GATED: the app checks the backend flag
// `MOBILE_OTA_ENABLED` (via /functions/mobileOtaConfig) BEFORE applying any bundle, and the plugin's blind
// auto-apply is OFF (autoUpdate:false in capacitor.config). So the operator can HALT a rollout instantly by
// flipping the flag off — an out-of-scope or bad bundle stops reaching users at once. A bad bundle that did
// apply also auto-rolls back on device (notifyAppReady). Default is OFF (opt-in).
//
// This module is a GUARDED integration of the open-source @capgo/capacitor-updater plugin. If the plugin
// isn't installed (or we're on plain web/PWA), every call no-ops. To go live: `npm i @capgo/capacitor-updater`,
// set the channel via the Capgo CLI, rebuild the native apps ONCE, then turn MOBILE_OTA_ENABLED on.
// See MOBILE-OTA-LIVE-UPDATES.md.

import { Capacitor } from '@capacitor/core';

const API_BASE = (import.meta.env?.VITE_NEXUS_API_URL || '').replace(/\/$/, '');
let _inited = false;

async function loadUpdater() {
  try {
    // Dynamic import so the build succeeds even when the plugin isn't installed yet.
    const mod = await import(/* @vite-ignore */ '@capgo/capacitor-updater').catch(() => null);
    return mod?.CapacitorUpdater || null;
  } catch { return null; }
}

/** Ask the backend whether OTA is currently allowed (the server-side kill-switch). Fail CLOSED: any error,
 *  or no API configured, means "do not apply an update" — the app keeps running its current bundle. */
async function otaAllowed() {
  if (!API_BASE) return { ok: false };
  try {
    const r = await fetch(`${API_BASE}/functions/mobileOtaConfig`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) return { ok: false };
    const cfg = await r.json();
    return { ok: cfg?.ota_enabled === true, channel: cfg?.channel || 'production' };
  } catch { return { ok: false }; }
}

/** Download + stage the latest bundle for the channel, applied on next launch. Uses the plugin's manual API
 *  (autoUpdate is off) so nothing applies unless we got here past the server gate + network guard. Best-effort. */
async function applyLatest(Updater) {
  try {
    const latest = await Updater.getLatest?.().catch(() => null);
    if (!latest || latest.error) return;                 // nothing newer, or channel unreachable
    if (!latest.url || !latest.version) return;
    const bundle = await Updater.download?.({ url: latest.url, version: latest.version }).catch(() => null);
    if (bundle?.id) await Updater.set?.({ id: bundle.id }).catch(() => null); // takes effect on next open
  } catch { /* best-effort; never block the app */ }
}

/** Initialize OTA on native only. Marks this bundle healthy (so a good update isn't rolled back), then — only
 *  if the server flag allows and we're on an allowed network — checks for and stages a newer bundle. */
export async function initOta() {
  if (_inited) return;
  _inited = true;
  if (!Capacitor?.isNativePlatform?.()) return; // PWA/web always has the latest — nothing to do
  const Updater = await loadUpdater();
  if (!Updater) return; // plugin not installed → OTA inactive, app works normally
  try {
    await Updater.notifyAppReady?.();                    // confirm this bundle is healthy (rollback safety)
    const gate = await otaAllowed();
    if (!gate.ok) return;                                // server kill-switch off → do not apply
    if (!(await onAllowedNetwork())) return;             // on cellular → defer to wifi
    await applyLatest(Updater);
  } catch { /* OTA is best-effort; never block the app */ }
}

// Skip downloads on a metered/cellular connection when possible, so OTA never eats a user's mobile data.
async function onAllowedNetwork() {
  try {
    const mod = await import(/* @vite-ignore */ '@capacitor/network').catch(() => null);
    const Network = mod?.Network;
    if (!Network) return true; // can't tell → allow (bundles are small/delta)
    const s = await Network.getStatus();
    if (!s?.connected) return false;
    if (s.connectionType === 'wifi' || s.connectionType === 'ethernet' || s.connectionType === 'unknown') return true;
    return false; // cellular → wait for wifi
  } catch { return true; }
}

/** Re-check for a newer bundle now (e.g. on app resume/login), honoring the server gate + metered guard.
 *  Applied on next open. */
export async function checkForOtaUpdate() {
  if (!Capacitor?.isNativePlatform?.()) return;
  const Updater = await loadUpdater();
  if (!Updater) return;
  const gate = await otaAllowed();
  if (!gate.ok) return;                                  // server kill-switch off → do not apply
  if (!(await onAllowedNetwork())) return;               // on cellular → defer to wifi
  await applyLatest(Updater);
}
