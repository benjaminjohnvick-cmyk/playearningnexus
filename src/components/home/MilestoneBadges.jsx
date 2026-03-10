import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Award } from 'lucide-react';

const BADGES = [
  { id: 'first_survey',  label: 'First Survey',   emoji: '🎯', threshold: 1   },
  { id: '5_surveys',     label: '5 Surveys',       emoji: '⭐', threshold: 5   },
  { id: '10_surveys',    label: '10 Surveys',      emoji: '🔥', threshold: 10  },
  { id: '25_surveys',    label: '25 Surveys',      emoji: '💎', threshold: 25  },
  { id: '50_surveys',    label: 'Survey Pro',      emoji: '🏆', threshold: 50  },
  { id: '100_surveys',   label: 'Legend',          emoji: '👑', threshold: 100 },
];

export default function MilestoneBadges({ user }) {
  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const count = responses.length;

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="flex items-center gap-2 mb-5">
        <Award className="w-5 h-5 text-purple-500" />
        <h3 className="font-bold text-lg text-gray-900">Survey Badges</h3>
        <span className="ml-auto text-xs text-gray-400">{count} completed</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {BADGES.map(badge => {
          const earned = count >= badge.threshold;
          return (
            <div key={badge.id} title={earned ? `Earned at ${badge.threshold} surveys` : `Complete ${badge.threshold} surveys to unlock`}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                earned
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-gray-100 bg-gray-50 opacity-40 grayscale'
              }`}>
              <span className="text-2xl">{badge.emoji}</span>
              <span className="text-xs font-medium text-center text-gray-700 leading-tight">{badge.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}