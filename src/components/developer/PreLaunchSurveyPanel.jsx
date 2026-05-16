import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Bot, CheckCircle2, AlertCircle, TrendingUp, Users, Lightbulb, Rocket, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function PreLaunchSurveyPanel({ gameData, onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | generating | survey_ready | analyzing | results
  const [surveyData, setSurveyData] = useState(null);
  const [surveyId, setSurveyId] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSurvey = async () => {
    setLoading(true);
    setPhase('generating');
    try {
      const res = await base44.functions.invoke('aiDevPreLaunchSurvey', {
        action: 'generate',
        game_title: gameData.game_title,
        game_description: gameData.game_description,
        game_category: gameData.game_category,
        platforms: gameData.platforms,
        demo_url: gameData.demo_url,
      });
      setSurveyData(res.data?.survey);
      setSurveyId(res.data?.survey_id);
      setPhase('survey_ready');
    } catch (e) {
      toast.error('Failed to generate survey: ' + e.message);
      setPhase('intro');
    }
    setLoading(false);
  };

  const analyzeResults = async () => {
    setLoading(true);
    setPhase('analyzing');
    try {
      const res = await base44.functions.invoke('aiDevPreLaunchSurvey', {
        action: 'analyze_results',
        survey_id: surveyId,
        game_title: gameData.game_title,
        game_category: gameData.game_category,
      });
      if (res.data?.responses_count === 0) {
        toast.info('No responses yet. Survey is live — check back later.');
        setPhase('survey_ready');
      } else {
        setResults(res.data?.analysis);
        setPhase('results');
      }
    } catch (e) {
      toast.error(e.message);
      setPhase('survey_ready');
    }
    setLoading(false);
  };

  const fitScoreColor = (score) => {
    if (score >= 75) return 'text-green-700 bg-green-50 border-green-300';
    if (score >= 50) return 'text-yellow-700 bg-yellow-50 border-yellow-300';
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const readinessConfig = {
    ready: { color: 'text-green-700', bg: 'bg-green-100', icon: Rocket, label: '🚀 Ready to Launch!' },
    needs_work: { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertCircle, label: '⚠️ Needs Improvements' },
    not_ready: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertCircle, label: '❌ Not Ready Yet' },
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-purple-600" />
          AI Pre-Launch Game Survey
          <Badge className="bg-purple-100 text-purple-700 ml-auto">Optional but Recommended</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">Test your game with real GamerGain users before going live. AI generates & analyzes feedback automatically.</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {phase === 'intro' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🎯', title: 'Market Fit', desc: 'Test audience appeal before launch' },
                { icon: '📊', title: 'AI Analysis', desc: 'Automated sentiment & readiness score' },
                { icon: '🚀', title: 'Launch Ready', desc: 'Get go/no-go recommendation' },
              ].map(item => (
                <div key={item.title} className="text-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-2xl mb-1">{item.icon}</p>
                  <p className="text-xs font-bold text-purple-700">{item.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1">🤖 How it works</p>
              <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                <li>AI generates 8-10 tailored survey questions for your specific game</li>
                <li>Survey is distributed to relevant GamerGain users</li>
                <li>AI analyzes responses and produces a launch readiness report</li>
                <li>You get actionable insights before spending on marketing</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => onComplete && onComplete({ skipped: true })}>
                Skip for Now
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600" onClick={generateSurvey}>
                <Bot className="w-4 h-4 mr-2" /> Generate Survey
              </Button>
            </div>
          </div>
        )}

        {phase === 'generating' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800">AI is crafting your survey...</p>
              <p className="text-sm text-gray-500 mt-1">Analyzing game details and generating targeted questions</p>
            </div>
          </div>
        )}

        {phase === 'survey_ready' && surveyData && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm font-bold text-green-700">Survey Live: "{surveyData.survey_title}"</p>
              </div>
              <p className="text-xs text-green-600">{surveyData.survey_description}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span>👥 Target: {surveyData.target_audience}</span>
                <span>⏱️ ~{surveyData.estimated_completion_minutes} min</span>
                <span>❓ {surveyData.questions?.length} questions</span>
              </div>
            </div>

            {/* Questions Preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">Survey Questions Preview:</p>
              {(surveyData.questions || []).slice(0, 4).map((q, i) => (
                <div key={q.id || i} className="p-2.5 bg-gray-50 rounded-lg border text-xs">
                  <p className="font-medium text-gray-700">{i + 1}. {q.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">{q.type?.replace('_', ' ')}</Badge>
                    <span className="text-gray-400 text-[10px]">{q.insight_goal}</span>
                  </div>
                </div>
              ))}
              {surveyData.questions?.length > 4 && (
                <p className="text-xs text-gray-400 text-center">+ {surveyData.questions.length - 4} more questions</p>
              )}
            </div>

            {/* Market Analysis */}
            {surveyData.market_analysis && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                  <Lightbulb className="w-3.5 h-3.5" /> AI Market Analysis
                </p>
                <p className="text-xs text-amber-600">{surveyData.market_analysis}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={analyzeResults} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                Check Results
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600" onClick={() => onComplete && onComplete({ survey_id: surveyId, skipped: false })}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Continue to Submit
              </Button>
            </div>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">AI analyzing survey responses...</p>
          </div>
        )}

        {phase === 'results' && results && (
          <div className="space-y-4">
            {/* Readiness Verdict */}
            {(() => {
              const cfg = readinessConfig[results.launch_readiness] || readinessConfig.needs_work;
              const Icon = cfg.icon;
              return (
                <div className={`p-4 rounded-xl border-2 ${fitScoreColor(results.market_fit_score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-lg">{cfg.label}</p>
                    <div className="text-right">
                      <p className="text-2xl font-black">{results.market_fit_score}/100</p>
                      <p className="text-xs font-medium">Market Fit Score</p>
                    </div>
                  </div>
                  <p className="text-sm">{results.summary}</p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {results.positive_signals?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="font-bold text-green-700 mb-1">✅ Positive Signals</p>
                  {results.positive_signals.slice(0, 3).map((s, i) => <p key={i} className="text-green-600">• {s}</p>)}
                </div>
              )}
              {results.concerns?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <p className="font-bold text-red-700 mb-1">⚠️ Concerns</p>
                  {results.concerns.slice(0, 3).map((c, i) => <p key={i} className="text-red-600">• {c}</p>)}
                </div>
              )}
            </div>

            {results.recommended_improvements?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-bold text-blue-700 mb-1">💡 Recommended Improvements</p>
                {results.recommended_improvements.map((r, i) => <p key={i} className="text-xs text-blue-600">• {r}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPhase('survey_ready')}>
                Back to Survey
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600" onClick={() => onComplete && onComplete({ survey_id: surveyId, analysis: results })}>
                <Rocket className="w-4 h-4 mr-2" /> Proceed to Submit
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}