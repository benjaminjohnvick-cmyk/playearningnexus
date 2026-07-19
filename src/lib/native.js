// Native integration layer for the Capacitor wrapper.
//
// Best-practice, wrapper-only approach: all native behavior is implemented HERE,
// in the web/TS layer, through Capacitor plugins — so there is no hand-written
// native (Java/Swift) code to maintain and no committed android/ios project.
// On plain web (the PWA), every call below no-ops via isNativePlatform().
import { Capacitor } from '@capacitor/core';

export async function initNative() {
  // On web/PWA there is nothing native to do.
  if (!Capacitor?.isNativePlatform?.()) return;

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
  } catch { /* plugin optional */ }
}
