import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Star, Clock, DollarSign, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const INTEREST_TAG_MAP = {
  Tech: ['technology', 'software', 'hardware', 'ai', 'gaming', 'computers'],
  Finance: ['finance', 'banking', 'investment', 'money', 'crypto', 'insurance'],
  Health: ['health', 'fitness', 'medical', 'wellness', 'diet', 'mental health'],
  Gaming: ['gaming', 'video games', 'esports', 'mobile games'],
  Travel: ['travel', 'tourism', 'hotels', 'airlines', 'vacation'],
  Food: ['food', 'restaurants', 'cooking', 'nutrition', 'beverages'],
  Fashion: ['fashion', 'clothing', 'beauty', 'cosmetics', 'style'],
  Sports: ['sports', 'fitness', 'athletics', 'outdoor'],
  Education: ['education', 'learning', 'courses', 'training'],
  Business: ['business', 'entrepreneurship', 'marketing', 'leadership'],
};

function scoreForUser(survey, userInterests = [], userGeo = '', avgQuality = 70, pastCategories = []) {
  let score = 0;

  // Interest match
  const surveyText = `${survey.title || ''} ${survey.category || ''} ${survey.description || ''}`.toLowerCase();
  userInterests.forEach(interest => {
    const keywords = INTEREST_TAG_MAP[interest] || [interest.toLowerCase()];
    if (keywords.some(kw => surveyText.includes(kw))) score += 30;
  });

  // Past category match
  if (pastCategories.includes(survey.category)) score += 15;

  // High reward
  const reward = survey.cost_per_response || 2;
  if (reward >= 5) score += 25;
  else if (reward >= 3) score += 15;
  else if (reward >= 2) score += 8;

  // Short duration bonus
  const mins = survey.estimated_time_minutes || 10;
  if (mins <= 3) score += 20;
  else if (mins <= 7) score += 10;

  // Quality alignment
  if (avgQuality >= 85) score += 10; // high quality users get more options shown

  return score;
}

function SurveyCard({ survey, userInterests, isHighMatch, isQuickEarn }) {
  const reward = survey.cost_per_response ? (survey.cost_per_response * 0.5).toFixed(2) : '—';
  const mins = survey.estimated_time_minutes || '?';

  return (
    <div className="bg-white rounded-xl border-2 border-transparent hover:border-blue-200 hover:shadow-md transition-all p-4 relative">
      {isHighMatch && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
          <Star className="w-3 h-3" /> High Match
        </div>
      )}
      {isQuickEarn && !isHighMatch && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
          <Zap className="w-3 h-3" /> Quick Earn
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{survey.title || 'Survey Opportunity'}</p>
          {survey.category && <p className="text-xs text-gray-400 mt-0.5">{survey.category}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-green-600">${reward}</p>
          <p className="text-xs text-gray-400">reward</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mins} min</span>
        {survey.completion_rate && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{survey.completion_rate}% completion</span>}
      </div>
      <Link to={createPageUrl('Surveys')}>
        <Button size="sm" className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700">Take Survey →</Button>
      </Link>
    </div>
  );
}

export default function RecommendedSurveysSection({ user }) {
  const userInterests = user?.survey_interests || [];
  const userGeo = user?.country || '';

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['recommended_surveys_feed'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
    enabled: !!user,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['user_survey_responses_history', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const avgQuality = useMemo(() => {
    if (!responses.length) return 70;
    return responses.reduce((s, r) => s + (r.quality_score || 70), 0) / responses.length;
  }, [responses]);

  const pastCategories = useMemo(() => {
    const cats = {};
    responses.forEach(r => { if (r.survey_category) cats[r.survey_category] = (cats[r.survey_category] || 0) + 1; });
    return Object.keys(cats);
  }, [responses]);

  const ranked = useMemo(() => {
    return surveys
      .map(s => ({
        ...s,
        _score: scoreForUser(s, userInterests, userGeo, avgQuality, pastCategories),
        _isQuickEarn: (s.estimated_time_minutes || 10) <= 5,
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  }, [surveys, userInterests, avgQuality, pastCategories]);

  if (isLoading || ranked.length === 0) return null;

  const topScore = ranked[0]?._score || 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Recommended For You
          </CardTitle>
          <div className="flex items-center gap-2">
            {userInterests.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end">
                {userInterests.slice(0, 3).map(t => (
                  <span key={t} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            <Link to={createPageUrl('Surveys')}>
              <Button size="sm" variant="outline" className="text-xs h-7">View All</Button>
            </Link>
          </div>
        </div>
        {userInterests.length === 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
            <Star className="w-3 h-3" /> Add interests in your profile for better matches
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ranked.map((survey, i) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              userInterests={userInterests}
              isHighMatch={i < 2 && survey._score >= topScore * 0.7 && survey._score > 20}
              isQuickEarn={survey._isQuickEarn}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}