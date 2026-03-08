import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Users, DollarSign, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, subDays } from 'date-fns';

const TOP_CHALLENGES = [
  { id: 'survey_streak_5', title: '5-Day Streak', icon: Flame, color: 'text-orange-500', metric: 'streak', target: 5, bonus: '$2.50' },
  { id: 'referral_gold_rush', title: 'Gold Rush', icon: Users, color: 'text-yellow-500', metric: 'referrals', target: 10, bonus: '$15' },
  { id: 'first_100', title: '$100 Earned', icon: DollarSign, color: 'text-green-500', metric: 'earnings', target: 100, bonus: '$10' },
];

export default function ChallengeProgress({ user, dailyEarnings = [], referrals = [] }) {
  const metrics = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const day = dailyEarnings.find(e => e.date === dateStr);
      if (day && day.total_surveys_completed > 0) streak++;
      else break;
    }
    return {
      streak,
      referrals: referrals.filter(r => r.status === 'active').length,
      earnings: dailyEarnings.reduce((s, e) => s + (e.total_earned || 0), 0),
    };
  }, [dailyEarnings, referrals]);

  const getVal = (metric) => metrics[metric] || 0;

  return (
    <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-600" /> Active Challenges
          </h3>
          <Link to={createPageUrl('Challenges')}>
            <Button size="sm" variant="ghost" className="text-purple-600 text-xs">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="space-y-4">
          {TOP_CHALLENGES.map(c => {
            const val = getVal(c.metric);
            const pct = Math.min((val / c.target) * 100, 100);
            const complete = val >= c.target;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${c.color}`} />
                    <span className="text-sm font-medium text-gray-800">{c.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{Math.min(val, c.target)}/{c.target}</span>
                    {complete
                      ? <Badge className="bg-green-100 text-green-700 text-xs animate-pulse">Claim {c.bonus}!</Badge>
                      : <Badge variant="outline" className="text-xs">{c.bonus}</Badge>}
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}