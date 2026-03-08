import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// High-value threshold in dollars
const HIGH_VALUE_THRESHOLD = 1.5;

// Interest → survey keyword mapping
const INTEREST_KEYWORDS = {
  tech:        ['technology', 'software', 'computer', 'app', 'gadget', 'ai', 'phone'],
  gaming:      ['game', 'gaming', 'console', 'esport', 'video game', 'mobile game'],
  sports:      ['sport', 'fitness', 'exercise', 'team', 'athletic', 'gym'],
  food:        ['food', 'restaurant', 'recipe', 'dining', 'cuisine', 'snack'],
  travel:      ['travel', 'hotel', 'flight', 'vacation', 'destination', 'trip'],
  fashion:     ['fashion', 'clothing', 'apparel', 'style', 'beauty', 'cosmetic'],
  health:      ['health', 'medical', 'wellness', 'medicine', 'doctor', 'pharma'],
  finance:     ['finance', 'investment', 'bank', 'crypto', 'money', 'insurance'],
  entertainment: ['movie', 'music', 'tv', 'streaming', 'entertainment', 'show'],
  home:        ['home', 'furniture', 'garden', 'appliance', 'decor', 'kitchen'],
  automotive:  ['car', 'vehicle', 'auto', 'truck', 'drive', 'ev'],
  parenting:   ['child', 'parent', 'baby', 'family', 'kid', 'toddler'],
  beauty:      ['beauty', 'skincare', 'makeup', 'cosmetic', 'hair', 'nail'],
  education:   ['education', 'learning', 'course', 'school', 'student', 'study'],
  environment: ['environment', 'eco', 'sustainable', 'green', 'climate', 'recycle'],
  politics:    ['political', 'government', 'election', 'policy', 'civic', 'vote'],
};

function matchesInterests(survey, interests = []) {
  if (!interests.length) return true; // No filter set = show all
  const text = `${survey.title || ''} ${survey.description || ''}`.toLowerCase();
  return interests.some(interest => {
    const keywords = INTEREST_KEYWORDS[interest] || [];
    return keywords.some(kw => text.includes(kw));
  });
}

function firePush(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export default function SurveyAlertWatcher({ user }) {
  const shownSurveysRef = useRef(new Set());
  const initializedRef = useRef(false);

  // Poll for recent high-value survey notifications created for this user
  const { data: notifications = [] } = useQuery({
    queryKey: ['survey-alert-notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({
      user_id: user.id,
      type: 'survey_available',
      status: 'unread',
    }, '-created_date', 5),
    enabled: !!user,
    refetchInterval: 30000, // poll every 30s
  });

  // Poll DailyEarnings to approximate activity and simulate survey availability
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['survey-watcher-activity', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 1),
    enabled: !!user,
    refetchInterval: 60000,
  });

  // On first load, seed the already-seen set so we don't spam on mount
  useEffect(() => {
    if (!initializedRef.current && notifications.length > 0) {
      notifications.forEach(n => shownSurveysRef.current.add(n.id));
      initializedRef.current = true;
    }
  }, []);

  // Watch for new unread survey_available notifications and toast them
  useEffect(() => {
    if (!initializedRef.current) return;
    notifications.forEach(notification => {
      if (shownSurveysRef.current.has(notification.id)) return;
      shownSurveysRef.current.add(notification.id);

      const interests = user?.survey_interests || [];
      const relevant = matchesInterests(notification, interests);
      if (!relevant) return;

      // In-app toast
      toast.success(notification.title || '🎯 High-Value Survey Available!', {
        description: notification.message || 'A survey matching your profile is ready. Complete it now for bonus earnings!',
        duration: 8000,
        action: {
          label: 'Take Survey',
          onClick: () => window.location.href = '/Surveys',
        },
      });

      // Browser push for high-value alerts
      firePush(
        notification.title || '💰 High-Value Survey Available!',
        notification.message || 'A survey worth $' + HIGH_VALUE_THRESHOLD + '+ matching your interests is ready!'
      );
    });
  }, [notifications, user]);

  // Request push permission on mount (once)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return null; // invisible watcher
}