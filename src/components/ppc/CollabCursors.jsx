import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const CURSOR_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

function getColor(index) {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

export function useCollabSession(surveyId, user) {
  const [collaborators, setCollaborators] = useState([]);
  const [mySessionId, setMySessionId] = useState(null);

  // Join / heartbeat
  useEffect(() => {
    if (!surveyId || !user) return;
    let sessionId = null;
    let heartbeatTimer = null;

    const join = async () => {
      const existing = await base44.entities.SurveyCollabSession.filter({ survey_id: surveyId, user_id: user.id });
      if (existing[0]) {
        sessionId = existing[0].id;
        await base44.entities.SurveyCollabSession.update(sessionId, {
          is_active: true, last_seen: new Date().toISOString(),
          user_name: user.full_name, user_avatar: user.avatar_url || '',
        });
      } else {
        const sess = await base44.entities.SurveyCollabSession.create({
          survey_id: surveyId, user_id: user.id,
          user_name: user.full_name, user_avatar: user.avatar_url || '',
          is_active: true, last_seen: new Date().toISOString(),
          color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
        });
        sessionId = sess.id;
      }
      setMySessionId(sessionId);

      heartbeatTimer = setInterval(async () => {
        if (sessionId) {
          await base44.entities.SurveyCollabSession.update(sessionId, { last_seen: new Date().toISOString(), is_active: true });
        }
      }, 10000);
    };

    join();

    // Subscribe to changes
    const unsub = base44.entities.SurveyCollabSession.subscribe(async () => {
      const cutoff = new Date(Date.now() - 30000).toISOString();
      const sessions = await base44.entities.SurveyCollabSession.filter({ survey_id: surveyId, is_active: true });
      setCollaborators(sessions.filter(s => s.user_id !== user.id && s.last_seen > cutoff));
    });

    return () => {
      clearInterval(heartbeatTimer);
      unsub();
      if (sessionId) {
        base44.entities.SurveyCollabSession.update(sessionId, { is_active: false });
      }
    };
  }, [surveyId, user?.id]);

  const updateCursor = useCallback(async (questionIndex, field) => {
    if (!mySessionId) return;
    await base44.entities.SurveyCollabSession.update(mySessionId, {
      cursor_position: { question_index: questionIndex, field },
      last_seen: new Date().toISOString(),
    });
  }, [mySessionId]);

  return { collaborators, updateCursor };
}

export function CollabAvatars({ collaborators }) {
  if (!collaborators.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 mr-1">Editing now:</span>
      {collaborators.map((c, i) => (
        <div key={c.id} className="relative group">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow"
            style={{ backgroundColor: c.color || getColor(i) }}
            title={c.user_name}
          >
            {(c.user_name || '?')[0].toUpperCase()}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
            {c.user_name}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CollabFieldHighlight({ collaborators, questionIndex, field, children }) {
  const activeHere = collaborators.filter(
    c => c.cursor_position?.question_index === questionIndex && c.cursor_position?.field === field
  );
  if (!activeHere.length) return children;

  return (
    <div className="relative">
      {children}
      <div
        className="absolute inset-0 rounded pointer-events-none border-2 opacity-40"
        style={{ borderColor: activeHere[0].color || '#7c3aed' }}
      />
      <div
        className="absolute -top-5 right-0 text-xs px-1.5 py-0.5 rounded text-white font-medium"
        style={{ backgroundColor: activeHere[0].color || '#7c3aed' }}
      >
        {activeHere[0].user_name}
      </div>
    </div>
  );
}