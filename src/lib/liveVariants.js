// Live-variants client — the request-time applier for UI experiments, plus outcome reporting.
//
// Quiet-swap: we fetch the user's variant assignments ONCE per browser session and cache them, so a
// running user's UI never shifts mid-session. A user is only (re)bucketed on a fresh session — i.e.
// while they're away — which is exactly the "change it when the user is individually inactive" behavior.
//
// getUiVariant(name) → the assigned UI variant string (or a fallback). reportMetric(metric) → tells the
// backend what the user actually did, attributed to their variant, so the live A/B can decide.

import { base44 } from '@/api/base44Client';

let _loaded = false;
let _loading = null;
let _ui = {};
const _subs = new Set();

function sessionId() {
  try { return sessionStorage.getItem('gg_session_id') || ''; } catch { return ''; }
}

// Fetch once per session; cache in sessionStorage so re-mounts don't refetch or flicker.
export function initLiveVariants() {
  if (_loaded || _loading) return _loading || Promise.resolve();
  try {
    const cached = sessionStorage.getItem('gg_live_ui');
    if (cached) { _ui = JSON.parse(cached) || {}; _loaded = true; return Promise.resolve(); }
  } catch { /* ignore */ }

  _loading = base44.functions.invoke('liveVariants', { session_id: sessionId() })
    .then((r) => {
      _ui = (r?.data?.ui) || {};
      _loaded = true;
      try { sessionStorage.setItem('gg_live_ui', JSON.stringify(_ui)); } catch { /* ignore */ }
      _subs.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    })
    .catch(() => { _loaded = true; })
    .finally(() => { _loading = null; });
  return _loading;
}

export function getUiVariant(name, fallback = 'control') {
  return Object.prototype.hasOwnProperty.call(_ui, name) ? _ui[name] : fallback;
}

export function isLoaded() { return _loaded; }
export function onVariantsLoaded(fn) { _subs.add(fn); return () => _subs.delete(fn); }

// Report an outcome/guardrail metric, attributed server-side to the user's variant in every running
// experiment. Fire-and-forget; never blocks or breaks the UI. Common: 'purchase', 'add_to_cart',
// 'click_through', 'begin_checkout', 'refund', 'complaint', 'drop_off'.
export function reportMetric(metric, value = 1) {
  try { base44.functions.invoke('recordVariantMetric', { metric, value }).catch(() => {}); } catch { /* ignore */ }
}
