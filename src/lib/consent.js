// consent.js — client-side consent state for cookies / tracking / CCPA "sale or share" (strict standard:
// GDPR/ePrivacy = no non-essential tracking before opt-in; CCPA/CPRA = a real "Do Not Sell or Share" +
// "Limit Use of Sensitive PI" opt-out). This is the single source of truth the banner writes and the trackers
// read. It also writes the legacy `gg_tracking_opt_out` flag that useSurveyUXTracker already honors.
//
// Categories:
//   • essential      — always on (security, fraud, load-balancing, remembering this choice). Never gated.
//   • analytics      — behavioral/UX analytics + session capture + live experiments. OFF until opted IN.
//   • sale_share_optout — CCPA/CPRA opt-out of "sale"/"sharing" of personal information.
//   • sensitive_limit   — CCPA/CPRA "Limit the Use of My Sensitive Personal Information".

const KEY = 'gg_consent_v1';
const LEGACY_OPTOUT = 'gg_tracking_opt_out';

const DEFAULT = { decided: false, analytics: false, sale_share_optout: false, sensitive_limit: false, ts: 0 };

export function getConsent() {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; }
  catch { return { ...DEFAULT }; }
}

function writeLegacyFlag(optedOut) {
  try {
    if (optedOut) localStorage.setItem(LEGACY_OPTOUT, '1');
    else localStorage.removeItem(LEGACY_OPTOUT);
  } catch { /* storage unavailable — ignore */ }
}

export function setConsent(patch) {
  const c = { ...getConsent(), ...patch, decided: true, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
  // The behavioral tracker is suppressed when the user turned analytics off OR opted out of sale/share.
  writeLegacyFlag(!c.analytics || c.sale_share_optout === true);
  try { window.dispatchEvent(new CustomEvent('gg-consent-changed', { detail: c })); } catch { /* ignore */ }
  return c;
}

export function hasDecided() { return getConsent().decided === true; }
// Non-essential analytics/session-capture run ONLY with an explicit opt-in and no sale/share opt-out.
export function hasAnalyticsConsent() { const c = getConsent(); return c.analytics === true && c.sale_share_optout !== true; }
export function isOptedOutSaleShare() { return getConsent().sale_share_optout === true; }
export function isSensitiveLimited() { return getConsent().sensitive_limit === true; }

export function acceptAll() { return setConsent({ analytics: true, sale_share_optout: false }); }
export function rejectNonEssential() { return setConsent({ analytics: false, sale_share_optout: true }); }

// Open the preferences panel from anywhere (e.g. the footer "Do Not Sell or Share" link).
export function openConsentPreferences() {
  try { window.dispatchEvent(new Event('gg-open-consent')); } catch { /* ignore */ }
}
