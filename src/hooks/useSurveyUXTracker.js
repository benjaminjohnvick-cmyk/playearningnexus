/**
 * useSurveyUXTracker
 *
 * Drop this hook into any survey-taking component.
 * Call startTracking(surveyId) when the survey starts,
 * recordQuestionAnswer(questionIndex) for each answer,
 * and finishTracking(responseId) when complete.
 *
 * All data is sent to surveyUXFraudAnalyzer for background AI analysis.
 */
import { useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useSurveyUXTracker(userId) {
  const sessionRef = useRef({
    sessionId: `ux_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    surveyId: null,
    startTime: null,
    questionTimings: [],
    lastQuestionTime: null,
    pageEvents: [],
    tabSwitches: 0,
    copyPasteDetected: false,
    autoFillDetected: false,
    keyboardShortcutAbuse: false,
    mouseMovements: [],
    idleTime: 0,
    lastActivityTime: Date.now(),
  });

  // ── Event Listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const sess = sessionRef.current;

    const onVisibilityChange = () => {
      if (document.hidden) sess.tabSwitches += 1;
      sess.pageEvents.push({ type: 'visibility', hidden: document.hidden, t: Date.now() });
    };

    const onPaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        sess.copyPasteDetected = true;
        sess.pageEvents.push({ type: 'paste', t: Date.now() });
      }
    };

    const onKeydown = (e) => {
      // Detect ctrl+a, ctrl+v, ctrl+c abuse patterns
      if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v'].includes(e.key.toLowerCase())) {
        sess.pageEvents.push({ type: 'keyboard_shortcut', key: e.key, t: Date.now() });
        const shortcuts = sess.pageEvents.filter(ev => ev.type === 'keyboard_shortcut');
        if (shortcuts.length > 10) sess.keyboardShortcutAbuse = true;
      }
      sess.lastActivityTime = Date.now();
    };

    const onMouseMove = (e) => {
      sess.mouseMovements.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      // Keep only last 50 points
      if (sess.mouseMovements.length > 50) sess.mouseMovements = sess.mouseMovements.slice(-50);
      sess.lastActivityTime = Date.now();
    };

    const onAutofill = () => {
      // Detect browser autofill via animationstart with specific name
      sess.autoFillDetected = true;
      sess.pageEvents.push({ type: 'autofill', t: Date.now() });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('animationstart', onAutofill);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('animationstart', onAutofill);
    };
  }, []);

  const startTracking = useCallback((surveyId) => {
    const sess = sessionRef.current;
    sess.surveyId = surveyId;
    sess.startTime = Date.now();
    sess.lastQuestionTime = Date.now();
    sess.pageEvents.push({ type: 'survey_start', t: Date.now() });
  }, []);

  const recordQuestionAnswer = useCallback((questionIndex, changed = false) => {
    const sess = sessionRef.current;
    const now = Date.now();
    const timeToAnswer = sess.lastQuestionTime ? now - sess.lastQuestionTime : 0;
    const focusEvents = sess.pageEvents.filter(
      e => e.type === 'focus' && e.t > (sess.lastQuestionTime || 0)
    ).length;

    sess.questionTimings.push({
      question_index: questionIndex,
      time_to_answer_ms: timeToAnswer,
      changed_answer: changed,
      focus_events: focusEvents
    });
    sess.lastQuestionTime = now;
    sess.pageEvents.push({ type: 'answer', question: questionIndex, t: now });
  }, []);

  const finishTracking = useCallback(async (responseId) => {
    const sess = sessionRef.current;
    if (!sess.startTime) return;

    const duration = Math.round((Date.now() - sess.startTime) / 1000);

    // Compute mouse pattern summary
    const movements = sess.mouseMovements;
    let avgSpeed = 0;
    if (movements.length > 1) {
      const speeds = movements.slice(1).map((m, i) => {
        const prev = movements[i];
        const dist = Math.sqrt((m.x - prev.x) ** 2 + (m.y - prev.y) ** 2);
        const dt = (m.t - prev.t) || 1;
        return dist / dt;
      });
      avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    }

    const mousePatterns = {
      avg_speed: Math.round(avgSpeed * 100) / 100,
      total_movements: movements.length,
      no_mouse_activity: movements.length < 5,
      idle_time_ms: Date.now() - sess.lastActivityTime
    };

    const deviceInfo = {
      userAgent: navigator.userAgent.substring(0, 150),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      cookiesEnabled: navigator.cookieEnabled,
      platform: navigator.platform
    };

    try {
      await base44.functions.invoke('surveyUXFraudAnalyzer', {
        action: 'record',
        user_id: userId,
        session_id: sess.sessionId,
        survey_id: sess.surveyId,
        response_id: responseId,
        question_timings: sess.questionTimings,
        mouse_patterns: mousePatterns,
        page_events: sess.pageEvents.slice(0, 100),
        tab_switches: sess.tabSwitches,
        copy_paste_detected: sess.copyPasteDetected,
        auto_fill_detected: sess.autoFillDetected,
        keyboard_shortcut_abuse: sess.keyboardShortcutAbuse,
        device_info: deviceInfo,
        session_duration_seconds: duration
      });
    } catch (_) {
      // Non-blocking — never interrupt the user experience
    }
  }, [userId]);

  return { startTracking, recordQuestionAnswer, finishTracking };
}