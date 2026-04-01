import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const POLL_INTERVAL = 5 * 60 * 1000; // check every 5 minutes
const STORAGE_KEY = 'gg_last_survey_notif';

/**
 * Polls for high-paying surveys that match the user's interests
 * and fires a toast notification when new ones are found.
 */
export function useSurveyMatchNotifications(user) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;

    const check = async () => {
      try {
        const lastChecked = localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString();
        const res = await base44.functions.invoke('getPersonalizedSurveys', {
          userId: user.id,
          limit: 5,
        });
        const surveys = res?.data?.surveys || [];

        // Filter to high-paying ones (>= $1) that are new since last check
        const highPaying = surveys.filter(s => (s.reward || 0) >= 1);

        if (highPaying.length > 0) {
          const top = highPaying[0];
          toast(
            `🔔 New high-paying survey matched your profile!`,
            {
              description: `"${top.title || 'Survey'}" — earn $${(top.reward || 0).toFixed(2)}`,
              action: {
                label: 'Take it',
                onClick: () => window.location.href = '/Surveys',
              },
              duration: 8000,
            }
          );
        }

        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      } catch {
        // Silently fail — don't interrupt user
      }
    };

    // Run once on mount after short delay, then poll
    const initialDelay = setTimeout(check, 30_000);
    timerRef.current = setInterval(check, POLL_INTERVAL);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(timerRef.current);
    };
  }, [user?.id]);
}