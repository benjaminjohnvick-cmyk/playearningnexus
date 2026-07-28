// Native integration layer for the Capacitor wrapper.
//
// Best-practice, wrapper-only approach: all native behavior is implemented HERE,
// in the web/TS layer, through Capacitor plugins — so there is no hand-written
// native (Java/Swift) code to maintain and no committed android/ios project.
// On plain web (the PWA), every call below no-ops via isNativePlatform().
import { Capacitor } from '@capacitor/core';
import { initOta, checkForOtaUpdate } from '@/lib/otaUpdate';
import { startSession } from '@/lib/liveVariants';

export async function initNative() {
  // On web/PWA there is nothing native to do.
  if (!Capacitor?.isNativePlatform?.()) return;

  // OTA live updates: pull newer web bundles to installed apps with no store review (guarded/no-op
  // until the Capgo plugin is installed). See MOBILE-OTA-LIVE-UPDATES.md.
  initOta();

  // Status bar color to match the app theme.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#111827' });
  } catch { /* plugin optional */ }

  // Hide the splash screen once the app has booted.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* plugin optional */ }

  // Android hardware back button: navigate back, or exit at the root.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });

    // App resume (foreground): re-pull the user's variant assignments and check for an OTA bundle, so a
    // change that was promoted while the app was backgrounded is applied on this open — no downtime,
    // quiet-swap. This is the native equivalent of "applied the next time they log in".
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) { try { startSession(true); } catch { /* ignore */ } checkForOtaUpdate(); }
    });

    // Deep links + OAuth return. When the app is opened via a URL
    // (com.playearningnexus.app://... or an https universal link), route it into the SPA.
    // This makes "Sign in with Google" and referral/deep links work inside the wrapper.
    App.addListener('appUrlOpen', ({ url }) => {
      try {
        const u = new URL(url);
        // OAuth return: if the provider handed back a token/code, stash it and go to the app.
        const token = u.searchParams.get('token') || u.hashParams?.get?.('access_token');
        if (token && typeof localStorage !== 'undefined') localStorage.setItem('nexus_token', token);
        // Route the path (strip the scheme/host) into the client-side router.
        const path = (u.pathname || '/') + (u.search || '');
        window.location.assign(path && path !== '/' ? path : '/');
      } catch { /* ignore malformed deep links */ }
    });
  } catch { /* plugin optional */ }

  // Native push notifications (FCM on Android, APNs on iOS). Registers for a device token and
  // posts it to the backend so the server can send pushes. No-ops if the plugin isn't installed.
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive === 'granted') {
      await PushNotifications.register();
      PushNotifications.addListener('registration', async (t) => {
        try {
          const api = (import.meta.env?.VITE_NEXUS_API_URL || '').replace(/\/$/, '');
          const jwt = typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_token') : null;
          if (api && jwt) await fetch(`${api}/functions/registerPushToken`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ token: t.value, platform: Capacitor.getPlatform?.() || 'unknown' }),
          });
        } catch { /* token post is best-effort */ }
      });
    }
  } catch { /* push plugin optional — app works fine without it */ }
}
