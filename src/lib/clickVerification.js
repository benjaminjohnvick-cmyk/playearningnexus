/**
 * Client-side bot/click verification using device fingerprinting
 * and interaction pattern analysis.
 */

// Build a lightweight device fingerprint
export function buildFingerprint() {
  const nav = window.navigator;
  const scr = window.screen;

  const components = [
    nav.userAgent,
    nav.language,
    nav.platform,
    nav.hardwareConcurrency || 0,
    nav.deviceMemory || 0,
    scr.width + 'x' + scr.height,
    scr.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.cookieEnabled,
    typeof window.indexedDB !== 'undefined',
    typeof window.localStorage !== 'undefined',
    nav.maxTouchPoints || 0,
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    hash = (hash << 5) - hash + components.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Interaction pattern tracker — call during survey session
export class InteractionTracker {
  constructor() {
    this.events = [];
    this.mouseMovements = 0;
    this.keyPresses = 0;
    this.startTime = Date.now();
    this._onMouseMove = () => { this.mouseMovements++; };
    this._onKey = () => { this.keyPresses++; };
    document.addEventListener('mousemove', this._onMouseMove, { passive: true });
    document.addEventListener('keydown', this._onKey, { passive: true });
  }

  recordClick(x, y) {
    this.events.push({ type: 'click', x, y, t: Date.now() - this.startTime });
  }

  destroy() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKey);
  }

  // Returns a risk assessment
  analyze() {
    const elapsed = Date.now() - this.startTime;
    const flags = [];

    // Too fast — bot completes survey in < 3 seconds
    if (elapsed < 3000) flags.push('too_fast');

    // No mouse movement at all (headless browser)
    if (this.mouseMovements < 3) flags.push('no_mouse');

    // Clicks at identical coordinates (programmatic clicking)
    if (this.events.length >= 2) {
      const allSamePos = this.events.every(
        e => e.x === this.events[0].x && e.y === this.events[0].y
      );
      if (allSamePos) flags.push('identical_clicks');
    }

    // All clicks fired in < 200ms intervals (automation)
    if (this.events.length >= 2) {
      const allFast = this.events.every((e, i) =>
        i === 0 ? true : (this.events[i].t - this.events[i - 1].t) < 200
      );
      if (allFast && this.events.length >= 3) flags.push('click_burst');
    }

    const riskScore = flags.length;
    return {
      flags,
      riskScore,
      isBot: riskScore >= 2,
      elapsed,
      mouseMovements: this.mouseMovements,
    };
  }
}

// Store per-fingerprint click history to detect duplicate submissions
const STORAGE_KEY = 'gg_fp_clicks';

export function hasAlreadyCompleted(adId) {
  const fp = buildFingerprint();
  const record = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  const key = `${fp}_${adId}`;
  return !!record[key];
}

export function markCompleted(adId) {
  const fp = buildFingerprint();
  const record = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  record[`${fp}_${adId}`] = Date.now();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}