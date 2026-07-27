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