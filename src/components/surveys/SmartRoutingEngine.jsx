import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, DollarSign, Target, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INTEREST_KEYWORDS = {
  Tech: ['technology', 'software', 'hardware', 'ai', 'gaming', 'computers', 'app'],
  Finance: ['finance', 'banking', 'investment', 'money', 'crypto'],
  Health: ['health', 'fitness', 'medical', 'wellness', 'diet'],
  Gaming: ['gaming', 'video games', 'esports', 'mobile'],
  Travel: ['travel', 'tourism', 'hotels', 'airlines'],
  Food: ['food', 'restaurants', 'cooking', 'nutrition'],
  Fashion: ['fashion', 'clothing', 'beauty', 'cosmetics'],
  Sports: ['sports', 'fitness', 'athletics'],
  Education: ['education', 'learning', 'courses'],
  Business: ['business', 'entrepreneurship', 'marketing'],
};

function scoreSurvey(survey, userInterests = [], avgQuality = 70, pastCategories = []) {
  let score = 0;
  const text = `${survey.title || ''} ${survey.category || ''}`.toLowerCase();
  userInterests.forEach(interest => {
    const kws = INTEREST_KEYWORDS[interest] || [interest.toLowerCase()];
    if (kws.some(kw => text.includes(kw))) score += 35;
  });
  if (pastCategories.includes(survey.category)) score += 20;
  const reward = survey.cost_per_response || 2;
  if (reward >= 5) score += 25;
  else if (reward >= 3) score += 15;
  const mins = survey.estimated_time_minutes || 10;
  if (mins <= 3) score += 20;
  else if (mins <= 6) score += 10;
  // Quality alignment: high-quality users get scored better for longer surveys
  if (avgQuality >= 85) score += 5;
  return score;
}

/**
 * Invisible engine that watches for disqualification events.
 * When triggered, shows a floating card with the next best survey suggestion.
 * 
 * Usage: <SmartRoutingEngine user={user} onSelectSurvey={(survey) => ...} />
 * Trigger: call window.__smartRouting?.triggerDisqualification(disqualSurveyId)
 */
export default function SmartRoutingEngine({ user, onSelectSurvey }) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const { data: activeSurveys = [] } = useQuery({
    queryKey: ['smart_routing_surveys'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
    enabled: !!user,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['smart_routing_history', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const avgQuality = responses.length
    ? responses.reduce((s, r) => s + (r.quality_score || 70), 0) / responses.length
    : 70;

  const completedSurveyIds = new Set(
    responses.filter(r => r.completed).map(r => r.survey_id)
  );

  const pastCategories = [...new Set(responses.map(r => r.survey_category).filter(Boolean))];
  const userInterests = user?.survey_interests || [];

  const findNextBest = useCallback((excludeSurveyId) => {
    const candidates = activeSurveys.filter(
      s => s.id !== excludeSurveyId && !completedSurveyIds.has(s.id)
    );
    if (!candidates.length) return null;
    const scored = candidates
      .map(s => ({ ...s, _score: scoreSurvey(s, userInterests, avgQuality, pastCategories) }))
      .sort((a, b) => b._score - a._score);
    return scored[0] || null;
  }, [activeSurveys, completedSurveyIds, userInterests, avgQuality, pastCategories]);

  // Expose trigger to global scope so PPCSurveyTaker / BitLabs can call it
  useEffect(() => {
    window.__smartRouting = {
      triggerDisqualification: (disqualSurveyId) => {
        setDismissed(false);
        const next = findNextBest(disqualSurveyId);
        setSuggestion(next);
      },
    };
    return () => { delete window.__smartRouting; };
  }, [findNextBest]);

  if (!suggestion || dismissed) return null;

  const reward = suggestion.cost_per_response
    ? (suggestion.cost_per_response * 0.5).toFixed(2)
    : '—';
  const mins = suggestion.estimated_time_minutes || '?';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.95 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <Card className="border-2 border-blue-400 shadow-2xl bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-bold">Smart Routing — Next Best Match</span>
            </div>
            <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-2">You were disqualified — here's your best next opportunity:</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">
                  {suggestion.title || 'Survey Opportunity'}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-green-600 font-bold">
                    <DollarSign className="w-3 h-3" />${reward} reward
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />{mins} min
                  </span>
                  {suggestion.category && (
                    <Badge className="text-xs bg-blue-100 text-blue-700 border-0">{suggestion.category}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm h-8 gap-1"
                onClick={() => { setDismissed(true); onSelectSurvey?.(suggestion); }}
              >
                Take This Survey <ArrowRight className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                className="text-sm h-8"
                onClick={() => setDismissed(true)}
              >
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}