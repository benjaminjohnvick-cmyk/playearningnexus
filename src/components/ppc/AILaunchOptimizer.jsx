import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Clock, TrendingUp, Globe, Users, Zap, CheckCircle2, Loader2,
  Star, AlertTriangle, ChevronDown, ChevronUp, Calendar, Target,
  BarChart2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const DEMOGRAPHICS = [
  'Ages 18–24 (Gen Z)',
  'Ages 25–34 (Millennials)',
  'Ages 35–54 (Gen X)',
  'Ages 55+ (Boomers)',
  'Gamers (all ages)',
  'Working Professionals',
  'Parents / Caregivers',
  'Students',
  'General Adult Population',
];

const REGIONS = [
  { id: 'us_east', label: 'US East' },
  { id: 'us_west', label: 'US West' },
  { id: 'uk', label: 'United Kingdom' },
  { id: 'europe', label: 'Western Europe' },
  { id: 'australia', label: 'Australia' },
  { id: 'india', label: 'India' },
  { id: 'canada', label: 'Canada' },
];

const CATEGORIES = ['Gaming', 'Consumer Products', 'Technology', 'Healthcare', 'Finance', 'Education', 'Entertainment', 'Food & Beverage', 'Travel', 'General'];

const CONFIDENCE_COLOR = (c) => c >= 85 ? 'text-green-600' : c >= 70 ? 'text-yellow-600' : 'text-orange-600';
const CONFIDENCE_BG = (c) => c >= 85 ? 'bg-green-100' : c >= 70 ? 'bg-yellow-100' : 'bg-orange-100';

function HeatmapCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = intensity > 0.75 ? 'bg-green-600 text-white' :
             intensity > 0.5  ? 'bg-green-400 text-white' :
             intensity > 0.25 ? 'bg-green-200 text-green-800' :
                                'bg-gray-100 text-gray-400';
  return (
    <div className={`${bg} rounded text-center text-xs py-1 font-semibold transition-all`}>
      {value > 0 ? `${value}%` : '—'}
    </div>
  );
}

function WindowCard({ window: w, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={`border-2 rounded-2xl overflow-hidden ${w.rank === 1 ? 'border-green-300 shadow-lg' : 'border-gray-200'}`}>
      <div className="p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{medals[w.rank - 1] || `#${w.rank}`}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-sm">{w.window_label}</h3>
                {w.rank === 1 && <Badge className="bg-green-100 text-green-700 text-xs">Best Window</Badge>}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                <strong>{w.utc_day}</strong> · {w.utc_start_hour}:00–{w.utc_end_hour}:00 UTC
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className={`text-lg font-black ${CONFIDENCE_COLOR(w.confidence)}`}>{w.confidence}%</div>
            <div className="text-xs text-gray-400">confidence</div>
          </div>
        </div>

        {/* Metric pills */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: 'Completion Rate', value: `${w.estimated_completion_rate}%`, color: 'bg-blue-50 text-blue-700' },
            { label: 'Quality Score', value: `${w.estimated_quality_score}/100`, color: 'bg-purple-50 text-purple-700' },
            { label: 'Demo Fit', value: `${w.demographic_fit_score}%`, color: 'bg-emerald-50 text-emerald-700' },
          ].map(m => (
            <div key={m.label} className={`${m.color} rounded-xl p-2 text-center`}>
              <p className="text-base font-black">{m.value}</p>
              <p className="text-xs opacity-75">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Local times */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(w.local_times_by_region || {}).map(([region, time]) => (
            <div key={region} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="font-medium text-gray-600">{region}:</span>
              <span className="text-gray-500">{time}</span>
            </div>
          ))}
        </div>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Less detail' : 'More detail'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 text-xs border-t border-gray-100 pt-3">
            <p className="text-gray-700 leading-relaxed"><strong>Why:</strong> {w.reasoning}</p>
            {w.best_for_regions?.length > 0 && (
              <p className="text-gray-500">
                <strong>Best for:</strong> {w.best_for_regions.join(', ')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Traffic overlap:</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${w.traffic_overlap_score || 0}%` }} />
              </div>
              <span className="font-semibold text-gray-600">{w.traffic_overlap_score}%</span>
            </div>
            <p className="text-gray-500">
              <strong>Potential volume:</strong>{' '}
              <span className={`font-semibold ${w.potential_respondents_estimate === 'high' ? 'text-green-600' : w.potential_respondents_estimate === 'medium' ? 'text-yellow-600' : 'text-gray-500'}`}>
                {w.potential_respondents_estimate || 'medium'}
              </span>
            </p>
          </div>
        )}

        <Button
          size="sm"
          onClick={() => onApply(w)}
          className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5" /> Use This Window
        </Button>
      </div>
    </div>
  );
}

export default function AILaunchOptimizer({ user, onWindowSelected }) {
  const [demographic, setDemographic] = useState('');
  const [selectedRegions, setSelectedRegions] = useState(['us_east', 'uk']);
  const [category, setCategory] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [numWindows, setNumWindows] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const { data: surveys = [] } = useQuery({
    queryKey: ['my-surveys-optimizer', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }),
    enabled: !!user?.id,
  });

  const toggleRegion = (id) => {
    setSelectedRegions(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleAnalyze = async () => {
    if (!demographic) return toast.error('Select a target demographic');
    if (selectedRegions.length === 0) return toast.error('Select at least one region');

    setLoading(true);
    setResult(null);
    try {
      const regionLabels = REGIONS.filter(r => selectedRegions.includes(r.id)).map(r => r.label);
      const res = await base44.functions.invoke('aiSurveyLaunchOptimizer', {
        survey_id: surveyId || null,
        demographic_group: demographic,
        target_regions: regionLabels,
        survey_category: category || 'General',
        num_windows: numWindows,
      });
      if (res.data?.success) {
        setResult(res.data);
        toast.success('AI analysis complete!');
      } else {
        toast.error(res.data?.error || 'Analysis failed');
      }
    } catch (err) {
      toast.error('Failed to run analysis: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyWindow = (window) => {
    if (onWindowSelected) {
      onWindowSelected(window);
      toast.success(`Window applied: ${window.window_label}`);
    } else {
      toast.info(`Best window: ${window.utc_day} ${window.utc_start_hour}:00–${window.utc_end_hour}:00 UTC`);
    }
  };

  // Build heatmap data from hour_stats
  const heatmapMax = result
    ? Math.max(...(result.hour_stats || []).map(h => h.completion_rate))
    : 0;

  const dayStats = result?.day_stats || [];
  const hourStats = result?.hour_stats || [];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Launch Time Optimizer</h2>
            <p className="text-indigo-100 text-sm mt-0.5">
              Analyzes global traffic trends, demographic engagement patterns, and your historical completion rates to recommend the highest-performing launch windows.
            </p>
          </div>
        </div>
      </div>

      {/* Config panel */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" /> Configure Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Target Demographic *</label>
              <Select value={demographic} onValueChange={setDemographic}>
                <SelectTrigger className="border-2 h-9 text-sm">
                  <SelectValue placeholder="Select demographic…" />
                </SelectTrigger>
                <SelectContent>
                  {DEMOGRAPHICS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Survey Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-2 h-9 text-sm">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Specific Survey (optional)</label>
              <Select value={surveyId} onValueChange={setSurveyId}>
                <SelectTrigger className="border-2 h-9 text-sm">
                  <SelectValue placeholder="Any survey (use all data)…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All historical data</SelectItem>
                  {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Number of Windows</label>
              <Select value={String(numWindows)} onValueChange={v => setNumWindows(Number(v))}>
                <SelectTrigger className="border-2 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} windows</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Region selector */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Target Regions *</label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(r => {
                const active = selectedRegions.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRegion(r.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all ${
                      active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    {r.label}
                    {active && <CheckCircle2 className="w-3 h-3 text-indigo-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={loading || !demographic || selectedRegions.length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing global traffic patterns…</>
              : <><Sparkles className="w-4 h-4" /> Analyze & Recommend Windows</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border-2 border-gray-100 rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => <div key={j} className="h-12 bg-gray-100 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Brain className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">{result.recommendations?.summary}</p>
                <div className="flex gap-4 mt-2 text-xs text-indigo-700 flex-wrap">
                  <span>📊 {result.data_points_analyzed} responses analyzed</span>
                  <span>📋 {result.surveys_analyzed} surveys studied</span>
                  <span>🌍 {selectedRegions.length} regions covered</span>
                </div>
              </div>
            </div>
            {result.recommendations?.demographic_insight && (
              <p className="text-xs text-indigo-700 border-t border-indigo-200 pt-2">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                <strong>Demographic insight:</strong> {result.recommendations.demographic_insight}
              </p>
            )}
            {result.recommendations?.weekly_pattern_insight && (
              <p className="text-xs text-indigo-700">
                <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
                <strong>Weekly pattern:</strong> {result.recommendations.weekly_pattern_insight}
              </p>
            )}
          </div>

          {/* Window cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(result.recommendations?.recommended_windows || []).map((w, i) => (
              <WindowCard key={i} window={w} onApply={handleApplyWindow} />
            ))}
          </div>

          {/* Avoided windows */}
          {result.recommendations?.avoided_windows?.length > 0 && (
            <Card className="border-2 border-orange-100">
              <CardContent className="p-4">
                <p className="text-sm font-bold text-orange-700 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Windows to Avoid
                </p>
                <ul className="space-y-1">
                  {result.recommendations.avoided_windows.map((w, i) => (
                    <li key={i} className="text-xs text-orange-600 flex items-start gap-1.5">
                      <span className="mt-0.5 flex-shrink-0">•</span> {w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Completion rate heatmap toggle */}
          <button
            onClick={() => setShowHeatmap(h => !h)}
            className="w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            {showHeatmap ? 'Hide' : 'Show'} hourly completion rate heatmap
            {showHeatmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHeatmap && hourStats.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Completion Rate by Hour (UTC) — Historical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-1 mb-4">
                  {hourStats.map(h => (
                    <div key={h.hour} className="text-center">
                      <HeatmapCell value={h.completion_rate} max={heatmapMax} />
                      <p className="text-xs text-gray-400 mt-0.5">{h.hour}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">Hour (UTC) — darker green = higher completion rate</p>

                {dayStats.length > 0 && (
                  <div className="mt-4 h-36">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Completion Rate by Day of Week</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dayStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip
                          formatter={(v) => [`${v}%`, 'Completion']}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        />
                        <Bar dataKey="completion_rate" radius={[4, 4, 0, 0]}>
                          {dayStats.map((d, i) => (
                            <Cell
                              key={i}
                              fill={d.completion_rate >= 70 ? '#16a34a' : d.completion_rate >= 50 ? '#ca8a04' : '#94a3b8'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}