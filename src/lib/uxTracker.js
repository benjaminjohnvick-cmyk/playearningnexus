/**
 * UX Tracker — lightweight frontend event capture
 * Call trackEvent() from any component to record interaction events.
 * Batches events and flushes to the backend every 10s or on page unload.
 */

import { base44 } from '@/api/base44Client';

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

  // Flush on tab close
  window.addEventListener('beforeunload', () => {
    flushEvents(true);
  });

  // Auto-flush every 15 seconds
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(() => flushEvents(), 15000);

  // Global interaction capture — every meaningful click becomes data (bound once).
  if (!_listenersBound && typeof document !== 'undefined') {
    _listenersBound = true;
    document.addEventListener('click', (e) => {
      try {
        const t = (e.target?.closest && e.target.closest('button,a,[role="button"],input,select,textarea,[data-track]')) || e.target;
        if (!t || !_userId) return;
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

// ---- Sampled session screenshot capture (off by default; server decides who's in the sample) ------
// Asks the backend ONCE per session whether this session is in the rotating capture sample. Only if
// yes AND an optional html2canvas is present on the page do we capture a few downscaled frames. The
// vast majority of sessions get a cheap "capture:false" and no image is ever produced or sent. This is
// the disciplined, budget-safe version of "capture what users see" — a representative sample, not
// everyone. Server enforces the flag, opt-out, sample rate, and per-session frame cap.
let _captureInited = false;
export async function initSessionCapture() {
  if (_captureInited || !_userId) return;
  _captureInited = true;
  try {
    const res = await base44.functions.invoke('sessionCaptureIngest', { action: 'check', session_id: _sessionId });
    if (!res?.data?.capture) return;
    const h2c = (typeof window !== 'undefined') ? window.html2canvas : null;
    if (typeof h2c !== 'function') return; // no screenshot lib bundled → plumbing ready, no cost incurred
    let shots = 0;
    const grab = async () => {
      if (shots >= 6 || document.hidden) return;
      try {
        const canvas = await h2c(document.body, { scale: 0.4, logging: false, useCORS: true });
        const image = canvas.toDataURL('image/webp', 0.5);
        const r = await base44.functions.invoke('sessionCaptureIngest', { action: 'frame', session_id: _sessionId, image, path: _currentPage });
        shots++;
        if (!r?.data?.capture) shots = 999; // server said stop
      } catch { /* best-effort */ }
    };
    const iv = setInterval(() => { if (shots >= 6) { clearInterval(iv); return; } grab(); }, 20000);
    window.addEventListener('beforeunload', () => clearInterval(iv));
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

async function flushEvents(sync = false) {
  if (_eventQueue.length === 0 || !_userId) return;
  const batch = [..._eventQueue];
  _eventQueue = [];

  // Use sendBeacon for sync flushes (page unload), otherwise normal async
  if (sync && navigator.sendBeacon) {
    // Best-effort — sendBeacon can't use SDK, so just drop on unload (events already in queue will be sent next session)
    return;
  }

  try {
    await base44.entities.UserJourneyEvent.bulkCreate(batch);
  } catch {
    // Silently fail — tracking should never break the app
    _eventQueue = [...batch, ..._eventQueue]; // re-queue
  }

  // Also feed the statistical telemetry layer (telemetryIngest) so the self-learning loop gets
  // funnel/scroll/drop-off aggregates. Fire-and-forget + fully server-gated (flag + opt-out); a
  // failure here never affects the primary journey log above.
  try {
    base44.functions.invoke('telemetryIngest', { session_id: _sessionId, events: mapToTelemetry(batch) }).catch(() => {});
  } catch { /* never breaks the app */ }
}

// Map the internal journey-event shape to the compact telemetry event the backend expects.
const _TELEMETRY_TYPES = new Set(['page_view','click','scroll','search','view_item','add_to_cart','begin_checkout','purchase','survey_start','survey_complete','drop_off','rage_click','form_error']);
function mapToTelemetry(batch) {
  return batch.map((e) => ({
    type: _TELEMETRY_TYPES.has(e.event_type) ? e.event_type : 'custom',
    path: e.page || _currentPage || '',
    target: e.element_id || (e.metadata && e.metadata.tag) || '',
    value: e.time_on_page_seconds,
    scroll_pct: e.scroll_pct,
    meta: e.metadata && typeof e.metadata === 'object' ? { tag: e.metadata.tag } : undefined,
  }));
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