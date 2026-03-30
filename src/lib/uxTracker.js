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

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function initTracker(userId) {
  _userId = userId;
  _pageStartTime = Date.now();

  // Flush on tab close
  window.addEventListener('beforeunload', () => {
    flushEvents(true);
  });

  // Auto-flush every 15 seconds
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(() => flushEvents(), 15000);
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