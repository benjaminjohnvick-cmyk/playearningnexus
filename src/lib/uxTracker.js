/**
 * UX Tracker — lightweight frontend event capture
 * Call trackEvent() from any component to record interaction events.
 * Batches events and flushes to the backend every 10s or on page unload.
 */

import { base44 } from '@/api/base44Client';

// Run a callback during browser idle time when available, so telemetry never competes with UI work.
const idle = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 2000 })
  : setTimeout(fn, 0));

const API_BASE = (import.meta.env?.VITE_NEXUS_API_URL || '').replace(/\/$/, '');

// Best-effort flush that survives page unload/background. Uses fetch({keepalive}) so the request both
// carries the auth header AND completes after the page goes away (a normal fetch is killed on unload).
// Falls back to sendBeacon only if keepalive isn't available.
function flushBeacon() {
  try {
    if (_eventQueue.length === 0 || !_userId || !API_BASE) return;
    const batch = [..._eventQueue];
    _eventQueue = [];
    const body = JSON.stringify({ session_id: _sessionId, journey: batch });
    const token = base44?.auth?.getToken?.();
    const url = `${API_BASE}/functions/telemetryIngest`;
    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body,
      }).catch(() => { _eventQueue = [...batch, ..._eventQueue]; });
    } else if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      _eventQueue = [...batch, ..._eventQueue];
    }
  } catch { /* never breaks the app */ }
}

let _userId = null;
let _sessionId = generateSessionId();
let _pageStartTime = Date.now();
let _currentPage = '';
let _eventQueue = [];
let _flushTimer = null;
let _listenersBound = false;
let _survey = null;      // active survey-honesty capture, if any
let _lastMouse = null;

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function initTracker(userId) {
  _userId = userId;
  _pageStartTime = Date.now();
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gg_session_id', _sessionId); } catch { /* ignore */ }

  // Auto-flush every 15s, but run the actual send during idle time so it never competes with UI work.
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(() => idle(() => flushEvents()), 15000);

  // Global interaction capture + unload/visibility flush — every meaningful click becomes data (bound
  // once, so re-calling initTracker on a user-id change doesn't stack duplicate handlers/beacons).
  if (!_listenersBound && typeof document !== 'undefined') {
    _listenersBound = true;
    // Flush on tab close via sendBeacon (survives unload; SDK fetch does not).
    window.addEventListener('beforeunload', () => { flushBeacon(); });
    // Also flush when the tab is hidden (mobile/native background) — more reliable than unload.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushBeacon(); });
    document.addEventListener('click', (e) => {
      try {
        const interactive = e.target?.closest && e.target.closest('button,a,[role="button"],input,select,textarea,[data-track]');
        const t = interactive || e.target;
        if (!t || !_userId) return;
        // Feed the structural heatmap: click coordinates + whether it was a "dead" click (nothing
        // interactive under the cursor) — a strong signal of a confusing/mislabeled UI.
        try { noteClick(e.clientX, e.clientY, t.tagName, !interactive); } catch { /* ignore */ }
        queueEvent({
          event_type: 'click',
          element_id: t.id || (t.getAttribute && (t.getAttribute('data-track') || t.getAttribute('name'))) || null,
          metadata: { tag: t.tagName, text: (t.innerText || '').slice(0, 40), href: (t.getAttribute && t.getAttribute('href')) || null },
        });
      } catch { /* tracking never breaks the app */ }
    }, { capture: true, passive: true });

    // Scroll depth — record the deepest scroll reached per page (throttled), so the AI can see how
    // far users actually get. One event per page when they pass 25/50/75/100% marks.
    let _scrollMarks = {};
    const _resetScroll = () => { _scrollMarks = {}; };
    window.addEventListener('gg:pagechange', _resetScroll);
    document.addEventListener('scroll', () => {
      if (!_userId) return;
      try {
        const doc = document.documentElement;
        const max = (doc.scrollHeight - doc.clientHeight) || 1;
        const pct = Math.max(0, Math.min(100, Math.round((doc.scrollTop / max) * 100)));
        const mark = pct >= 100 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
        if (mark && !_scrollMarks[mark]) {
          _scrollMarks[mark] = true;
          queueEvent({ event_type: 'scroll', page: _currentPage, scroll_pct: mark });
        }
      } catch { /* never breaks the app */ }
    }, { capture: true, passive: true });

    // Mouse movement is sampled only while a survey-honesty capture is active.
    document.addEventListener('mousemove', (e) => {
      if (!_survey) return;
      if (_lastMouse) {
        const dx = e.clientX - _lastMouse.x, dy = e.clientY - _lastMouse.y;
        _survey.mouse.distance += Math.round(Math.sqrt(dx * dx + dy * dy));
      }
      _survey.mouse.moves++;
      _lastMouse = { x: e.clientX, y: e.clientY };
    }, { passive: true });
  }
}

// ---- Survey honesty capture -------------------------------------------------------------------
// Instrument a survey so the AI can judge whether the user genuinely answered vs. button-mashed:
//   startSurvey(id) on open → trackSurveyAnswer(qid) per answer → finishSurvey(responseId) on submit.
// finishSurvey ships the per-question timings + mouse pattern to surveyUXFraudAnalyzer (LLM analysis
// of straight-lining, robotic timing, no-mouse-movement, auto-fill, etc.).
export function startSurvey(surveyId) {
  _survey = { surveyId, startedAt: Date.now(), lastAt: Date.now(), timings: {}, mouse: { moves: 0, distance: 0 }, answers: 0 };
}
export function trackSurveyAnswer(questionId) {
  if (!_survey) return;
  const now = Date.now();
  _survey.timings[questionId] = Math.round(((now - _survey.lastAt) / 1000) * 100) / 100;
  _survey.lastAt = now;
  _survey.answers++;
}
export async function finishSurvey(responseId, surveyId) {
  if (!_survey) return;
  const rec = _survey; _survey = null;
  try {
    await base44.functions.invoke('surveyUXFraudAnalyzer', {
      response_id: responseId,
      survey_id: surveyId || rec.surveyId,
      question_timings: rec.timings,
      mouse_patterns: rec.mouse,
      total_time_seconds: Math.round((Date.now() - rec.startedAt) / 1000),
      answers_count: rec.answers,
    });
  } catch { /* honesty analysis is best-effort */ }
}

export function setPage(pageName, featureArea) {
  // Record time spent on previous page
  if (_currentPage && _userId) {
    const timeOnPage = Math.round((Date.now() - _pageStartTime) / 1000);
    if (timeOnPage > 2) {
      queueEvent({
        event_type: 'page_view',
        page: _currentPage,
        feature_area: featureArea || mapPageToFeature(_currentPage),
        time_on_page_seconds: timeOnPage,
      });
    }
  }
  _currentPage = pageName;
  _pageStartTime = Date.now();
  try { window.dispatchEvent(new Event('gg:pagechange')); } catch { /* ignore */ }
}

// ---- Sampled structural / heatmap capture (cheap replacement for pixel screenshots) ---------------
// Instead of rasterizing the DOM with html2canvas (CPU-heavy, can jank the main thread, and uploads a
// fat image), we capture a tiny STRUCTURAL snapshot: viewport, how far the user scrolled, where they
// clicked, and the bounding boxes/labels of the interactive elements + which were above the fold. That
// gives the AI the same "what do users see, where do they get stuck, what's above the fold, where are
// the dead zones" design signal for ~1 KB and near-zero client cost — no image, no rasterization. The
// server still decides who's in the rotating sample; the vast majority get a cheap "capture:false".
let _captureInited = false;
let _clickPoints = [];
let _deadClicks = 0, _rageClicks = 0, _lastClickAt = 0, _lastClickXY = null;

// Record a lightweight click point for the heatmap (bound the array).
function noteClick(x, y, tag, dead) {
  if (_clickPoints.length < 60) _clickPoints.push({ x: Math.round(x), y: Math.round(y), tag: tag || '', dead: !!dead });
  const now = Date.now();
  if (_lastClickXY && Math.abs(x - _lastClickXY.x) < 24 && Math.abs(y - _lastClickXY.y) < 24 && now - _lastClickAt < 800) _rageClicks++;
  if (dead) _deadClicks++;
  _lastClickAt = now; _lastClickXY = { x, y };
}

// Build a compact structural snapshot of the current viewport (no pixels).
function buildSnapshot() {
  try {
    const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
    const doc = document.documentElement;
    const scrollMax = (doc.scrollHeight - doc.clientHeight) || 1;
    const scrollPct = Math.max(0, Math.min(100, Math.round((doc.scrollTop / scrollMax) * 100)));
    const els = [];
    const nodes = document.querySelectorAll('button,a,[role="button"],input,select,textarea,[data-track],h1,h2');
    for (let i = 0; i < nodes.length && els.length < 40; i++) {
      const el = nodes[i];
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const visible = r.top < vh && r.bottom > 0;
      els.push({
        tag: el.tagName, label: (el.innerText || el.getAttribute?.('aria-label') || el.getAttribute?.('name') || '').slice(0, 40),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        above_fold: r.top < vh, visible,
      });
    }
    return {
      path: _currentPage, viewport: { w: vw, h: vh }, scroll_pct: scrollPct,
      clicks: _clickPoints.slice(), elements: els, dead_clicks: _deadClicks, rage_clicks: _rageClicks,
      ts: new Date().toISOString(),
    };
  } catch { return null; }
}

export async function initSessionCapture() {
  if (_captureInited || !_userId) return;
  _captureInited = true;
  try {
    const res = await base44.functions.invoke('sessionCaptureIngest', { action: 'check', session_id: _sessionId });
    if (!res?.data?.capture) return; // not in the sample → nothing captured
    let sent = 0;
    const grab = () => {
      if (sent >= 6 || document.hidden) return;
      const snap = buildSnapshot();
      if (!snap) return;
      base44.functions.invoke('sessionCaptureIngest', { action: 'snapshot', session_id: _sessionId, snapshot: snap })
        .then((r) => { sent++; if (!r?.data?.capture) sent = 999; })
        .catch(() => {});
    };
    // Capture during idle time only, so it never competes with rendering.
    const iv = setInterval(() => { if (sent >= 6) { clearInterval(iv); return; } idle(grab); }, 20000);
    window.addEventListener('beforeunload', () => { clearInterval(iv); });
  } catch { /* capture is always best-effort */ }
}

export function trackEvent(eventType, options = {}) {
  if (!_userId) return;
  queueEvent({
    event_type: eventType,
    page: options.page || _currentPage,
    feature_area: options.feature_area || mapPageToFeature(_currentPage),
    element_id: options.element_id,
    time_on_page_seconds: Math.round((Date.now() - _pageStartTime) / 1000),
    scroll_pct: options.scroll_pct,
    metadata: options.metadata,
    is_friction_point: options.is_friction_point || false,
  });
}

function queueEvent(eventData) {
  _eventQueue.push({
    user_id: _userId,
    session_id: _sessionId,
    ...eventData,
  });

  // Flush immediately if queue gets large
  if (_eventQueue.length >= 20) flushEvents();
}

async function flushEvents() {
  if (_eventQueue.length === 0 || !_userId) return;
  const batch = [..._eventQueue];
  _eventQueue = [];

  // ONE coalesced request: telemetryIngest persists the journey rows AND the statistical aggregate
  // server-side, so the client no longer makes two calls per flush. Fully server-gated (flag/opt-out/
  // sample); a failure re-queues so nothing is lost. (Unload/background use flushBeacon instead.)
  try {
    await base44.functions.invoke('telemetryIngest', { session_id: _sessionId, journey: batch });
  } catch {
    _eventQueue = [...batch, ..._eventQueue]; // re-queue — tracking never breaks the app
  }
}

export function mapPageToFeature(pageName) {
  const map = {
    Surveys: 'surveys', PPCMarketplace: 'ppc_marketplace',
    ReferralDashboard: 'referrals', ReferralContest: 'referrals',
    ReferralHub: 'referrals', Withdrawal: 'withdrawal',
    MyPayouts: 'withdrawal', PayoutSettings: 'withdrawal',
    InAppGameStore: 'game_store', UserDashboard: 'dashboard',
    GlobalLeaderboard: 'leaderboard', Leaderboard: 'leaderboard',
    AchievementsPage: 'achievements', Wishlist: 'wishlist',
    CreatorDashboard: 'creator_hub', CreatorMarketplace: 'creator_hub',
    Settings: 'settings', DisputeCenter: 'dispute_center',
    Home: 'dashboard', UserProfile: 'settings',
  };
  return map[pageName] || 'other';
}

export function getSessionId() { return _sessionId; }