import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, Zap, Star, RefreshCw, Loader2, Target, ChevronRight, TrendingUp, Languages, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/components/locale/LocaleContext';
import SurveyLanguageToggle from '@/components/surveys/SurveyLanguageToggle';

const CATEGORY_COLORS = {
  lifestyle:  'bg-pink-100 text-pink-700',
  tech:       'bg-blue-100 text-blue-700',
  technology: 'bg-blue-100 text-blue-700',
  marketing:  'bg-purple-100 text-purple-700',
  health:     'bg-green-100 text-green-700',
  finance:    'bg-amber-100 text-amber-700',
  gaming:     'bg-indigo-100 text-indigo-700',
  general:    'bg-gray-100 text-gray-700',
};

const DIFFICULTY_CFG = {
  Easy:   { color: 'text-green-600', bg: 'bg-green-100',  icon: '⚡' },
  Medium: { color: 'text-amber-600', bg: 'bg-amber-100',  icon: '⏱️' },
  Long:   { color: 'text-red-500',   bg: 'bg-red-100',    icon: '⌛' },
};

const INTEREST_TAGS = ['Gaming', 'Tech', 'Health', 'Finance', 'Food', 'Travel', 'Fashion', 'Sports', 'Music', 'Movies'];

const SORT_OPTIONS = [
  { key: 'epm',   label: '⚡ $/Min' },
  { key: 'match', label: '🎯 Best Match' },
  { key: 'earn',  label: '💰 Earnings' },
  { key: 'time',  label: '⏱️ Shortest' },
];

const titleCache = {};

function SurveyCard({ survey, onStart, language, translatedTitle }) {
  const catKey = (survey.category || 'general').toLowerCase();
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.general;
  const diff = DIFFICULTY_CFG[survey.difficulty] || DIFFICULTY_CFG.Medium;
  const matchPct = survey.match_pct || 0;
  const earnPerMin = survey.loi > 0
    ? (parseFloat(survey.user_earn) / survey.loi).toFixed(3)
    : '0';

  const displayTitle = translatedTitle || survey.title;

  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-all group overflow-hidden">
      <div className="h-1 w-full bg-gray-100">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${matchPct}%` }} />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm leading-snug">{displayTitle}</p>
            {language !== 'en' && translatedTitle && (
              <p className="text-[10px] text-gray-400 mt-0.5 italic truncate">{survey.title}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{survey.category}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff.bg} ${diff.color}`}>
                {diff.icon} {survey.difficulty}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
              matchPct >= 85 ? 'bg-indigo-600 text-white' : matchPct >= 65 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>{matchPct}%</div>
            <span className="text-xs text-gray-400 mt-0.5">match</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 rounded-lg p-2">
            <p className="font-bold text-green-700 text-base">${survey.user_earn}</p>
            <p className="text-xs text-gray-500">You earn</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="font-bold text-gray-700 text-base flex items-center justify-center gap-0.5">
              <Clock className="w-3 h-3" /> {survey.loi}m
            </p>
            <p className="text-xs text-gray-500">Duration</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <p className="font-bold text-purple-700 text-base">${earnPerMin}</p>
            <p className="text-xs text-gray-500">$/min</p>
          </div>
        </div>

        {parseFloat(earnPerMin) >= 0.3 && (
          <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-1">
            <Zap className="w-3 h-3" />
            <span className="font-semibold">High efficiency</span> — great use of your time
          </div>
        )}

        <Button
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-1 transition-all"
          size="sm"
          onClick={() => onStart(survey)}
        >
          <Zap className="w-3.5 h-3.5" /> Start Survey <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PersonalizedSurveyCards({ user, onSurveyStart }) {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);
  const [sortBy, setSortBy] = useState('epm');
  const [translatedTitles, setTranslatedTitles] = useState({});
  const [translating, setTranslating] = useState(false);
  const { language } = useLocale();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['personalized-surveys', user?.id, selectedInterests],
    queryFn: () => base44.functions.invoke('getPersonalizedSurveys', {
      interests: selectedInterests,
      age: user?.age,
      gender: user?.gender,
    }).then(r => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const surveys = data?.surveys || [];
  const source = data?.source;

  const enriched = surveys.map(s => ({
    ...s,
    earn_per_min: s.loi > 0 ? parseFloat(s.user_earn) / s.loi : 0,
  }));

  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === 'epm')  return b.earn_per_min - a.earn_per_min;
    if (sortBy === 'earn') return parseFloat(b.user_earn) - parseFloat(a.user_earn);
    if (sortBy === 'time') return a.loi - b.loi;
    return b.score - a.score;
  });

  useEffect(() => {
    if (language === 'en' || sorted.length === 0) { setTranslatedTitles({}); return; }
    const titles = sorted.map(s => s.title);
    const cacheKey = `${language}::${titles.join('|')}`;
    if (titleCache[cacheKey]) {
      const cached = titleCache[cacheKey];
      const map = {};
      sorted.forEach((s, i) => { map[s.id] = cached[i]; });
      setTranslatedTitles(map);
      return;
    }
    setTranslating(true);
    base44.functions.invoke('translateText', { texts: titles, targetLanguage: language })
      .then(res => {
        const translated = res.data?.translations || titles;
        titleCache[cacheKey] = translated;
        const map = {};
        sorted.forEach((s, i) => { map[s.id] = translated[i]; });
        setTranslatedTitles(map);
      })
      .catch(() => {})
      .finally(() => setTranslating(false));
  }, [language, surveys.length]);

  const toggleInterest = (tag) => {
    setSelectedInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleStart = (survey) => {
    if (survey.link) {
      window.open(survey.link, '_blank');
    } else {
      toast.info('Opening survey wall...');
      if (onSurveyStart) onSurveyStart(survey);
    }
  };

  const totalEarnable = sorted.reduce((s, sv) => s + parseFloat(sv.user_earn || 0), 0);
  const bestEpm = sorted[0]?.earn_per_min || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" /> Personalized For You
          </h3>
          {sorted.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {sorted.length} surveys · up to <span className="font-semibold text-green-600">${totalEarnable.toFixed(2)}</span> earnable
              {bestEpm > 0 && <> · best <span className="font-semibold text-purple-600">${bestEpm.toFixed(3)}/min</span></>}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <SurveyLanguageToggle compact />
          <Button variant="outline" size="sm" onClick={() => setShowInterests(p => !p)} className="gap-1 text-xs">
            <Star className="w-3.5 h-3.5 text-amber-500" /> Interests {selectedInterests.length > 0 && `(${selectedInterests.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-1 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
              sortBy === opt.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {translating && (
          <span className="text-xs text-indigo-500 flex items-center gap-1 ml-1">
            <Languages className="w-3 h-3 animate-pulse" /> Translating...
          </span>
        )}
      </div>

      {showInterests && (
        <Card className="border-indigo-100 bg-indigo-50">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-indigo-700 font-semibold mb-2">Select interests for better matches:</p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleInterest(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selectedInterests.includes(tag)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {source === 'demo' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 flex-shrink-0" />
          Sample cards shown — live surveys appear once your BitLabs account is active.
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Finding your best surveys...</p>
        </div>
      ) : sorted.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No surveys available right now</p>
            <p className="text-xs text-gray-400 mt-1">Try refreshing or adjusting your interest tags</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(s => (
            <SurveyCard
              key={s.id}
              survey={s}
              onStart={handleStart}
              language={language}
              translatedTitle={translatedTitles[s.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}