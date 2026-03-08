import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, DollarSign, Clock, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Static survey pool – in production this would come from BitLabs API
const SURVEY_POOL = [
  { id: 's1', title: 'Consumer Shopping Habits', category: 'Shopping', earn: 1.80, time: 8, completion_rate: 87, cpi: 'high', tags: ['shopping', 'lifestyle'] },
  { id: 's2', title: 'Mobile Gaming Preferences', category: 'Gaming', earn: 2.40, time: 12, completion_rate: 91, cpi: 'high', tags: ['gaming', 'apps'] },
  { id: 's3', title: 'Health & Wellness Survey', category: 'Health', earn: 1.20, time: 6, completion_rate: 94, cpi: 'medium', tags: ['health', 'fitness'] },
  { id: 's4', title: 'Tech Product Opinions', category: 'Technology', earn: 3.00, time: 15, completion_rate: 78, cpi: 'high', tags: ['tech', 'gadgets'] },
  { id: 's5', title: 'Food & Beverage Preferences', category: 'Food', earn: 0.90, time: 5, completion_rate: 96, cpi: 'low', tags: ['food', 'diet'] },
  { id: 's6', title: 'Financial Planning Survey', category: 'Finance', earn: 2.10, time: 10, completion_rate: 82, cpi: 'high', tags: ['finance', 'investing'] },
  { id: 's7', title: 'Social Media Usage Study', category: 'Social', earn: 1.50, time: 7, completion_rate: 89, cpi: 'medium', tags: ['social', 'lifestyle'] },
  { id: 's8', title: 'Travel & Vacation Planning', category: 'Travel', earn: 2.70, time: 13, completion_rate: 85, cpi: 'high', tags: ['travel', 'leisure'] },
];

const CPI_COLORS = { high: 'bg-green-100 text-green-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };

function scoresurvey(survey, completedCategories = []) {
  // AI-style scoring: higher earn + high completion rate + matching user history
  let score = (survey.earn * 10) + (survey.completion_rate * 0.3);
  if (completedCategories.includes(survey.category)) score += 15; // boost known categories
  score += (100 - survey.time) * 0.5; // shorter = better
  return score;
}

export default function RecommendedSurveys({ user, compact = false }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-recommended', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
    enabled: !!user
  });

  // Infer completed categories from earnings history
  const completedCategories = ['Gaming', 'Shopping']; // would come from survey completion data

  const ranked = [...SURVEY_POOL]
    .map(s => ({ ...s, score: scoresurvey(s, completedCategories) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, compact ? 3 : 6);

  const totalEarnable = ranked.reduce((s, r) => s + r.earn, 0);

  useEffect(() => {
    if (!user || aiInsight || compact) return;
    const fetchInsight = async () => {
      setAiLoading(true);
      try {
        const resp = await base44.integrations.Core.InvokeLLM({
          prompt: `A GamerGain user has completed ${dailyEarnings.length} survey sessions and earned $${dailyEarnings.reduce((s, e) => s + (e.total_earned || 0), 0).toFixed(2)} total. Their daily goal is $3. Write ONE short motivational sentence (max 15 words) encouraging them to complete more surveys today. Be specific about earning potential.`
        });
        setAiInsight(typeof resp === 'string' ? resp : null);
      } catch { /* silent */ }
      setAiLoading(false);
    };
    fetchInsight();
  }, [user?.id, dailyEarnings.length]);

  if (compact) {
    return (
      <div className="space-y-3">
        {ranked.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-400">{s.time} min · {s.completion_rate}% complete rate</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-green-600">${s.earn.toFixed(2)}</p>
              <Badge className={`text-xs ${CPI_COLORS[s.cpi]}`}>{s.cpi} pay</Badge>
            </div>
          </div>
        ))}
        <Link to={createPageUrl('Surveys')}>
          <Button className="w-full bg-green-600 hover:bg-green-700 mt-1" size="sm">
            Start Earning <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-600" />
            Recommended For You
            <Badge className="bg-green-100 text-green-700 text-xs ml-1">AI-Matched</Badge>
          </CardTitle>
          <span className="text-sm text-green-600 font-semibold">Up to ${totalEarnable.toFixed(2)} available</span>
        </div>
        {aiLoading && <div className="flex items-center gap-2 text-xs text-gray-400 mt-1"><Loader2 className="w-3 h-3 animate-spin" /> Personalizing…</div>}
        {aiInsight && !aiLoading && (
          <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mt-2 font-medium">✨ {aiInsight}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ranked.map((s, i) => (
            <Link key={s.id} to={createPageUrl('Surveys')}>
              <div className={`relative rounded-xl border-2 p-4 hover:shadow-lg transition-all cursor-pointer ${i === 0 ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-gray-100 bg-white hover:border-green-200'}`}>
                {i === 0 && (
                  <div className="absolute -top-2 left-3">
                    <Badge className="bg-green-600 text-white text-xs"><Zap className="w-3 h-3 mr-1" />Top Pick</Badge>
                  </div>
                )}
                <div className="flex items-start justify-between mb-3 mt-1">
                  <div>
                    <Badge variant="outline" className="text-xs mb-1">{s.category}</Badge>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{s.title}</p>
                  </div>
                  <p className="text-2xl font-black text-green-600 flex-shrink-0 ml-2">${s.earn.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time} min</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{s.completion_rate}% finish</span>
                  <Badge className={`ml-auto text-xs ${CPI_COLORS[s.cpi]}`}>{s.cpi}</Badge>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${s.completion_rate}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}