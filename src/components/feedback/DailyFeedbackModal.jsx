import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronRight, ChevronLeft, X, ClipboardList, Loader2, Lightbulb, Trophy } from 'lucide-react';

const STORAGE_KEY = 'gg_feedback_dismissed_date';

const CATEGORY_OPTIONS = [
  { value: 'games', label: '🎮 Games' },
  { value: 'surveys', label: '📋 Surveys' },
  { value: 'products', label: '🛍️ Products' },
  { value: 'features', label: '✨ Features' },
  { value: 'ui_ux', label: '🎨 UI/UX' },
  { value: 'payouts', label: '💰 Payouts' },
  { value: 'referrals', label: '👥 Referrals' },
  { value: 'other', label: '💬 Other' },
];

export default function DailyFeedbackModal({ user }) {
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Suggestion state (last step of the survey)
  const [suggestion, setSuggestion] = useState('');
  const [suggestionCategory, setSuggestionCategory] = useState('features');

  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(STORAGE_KEY) === today) return;
    loadSurvey();
  }, [user]);

  const loadSurvey = async () => {
    try {
      const res = await base44.functions.invoke('getTodayFeedbackSurvey', {});
      const { survey: s, already_completed } = res.data;
      if (!s || already_completed) {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString().split('T')[0]);
        return;
      }
      setSurvey(s);
      setVisible(true);
    } catch (e) {
      console.error('Feedback survey load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const questions = survey?.questions || [];
  // Total steps = survey questions + 1 suggestion step
  const totalSteps = questions.length + 1;
  const isSuggestionStep = currentQ === questions.length;
  const progress = (currentQ / totalSteps) * 100;
  const q = !isSuggestionStep ? questions[currentQ] : null;

  const setAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => setCurrentQ(c => c + 1);
  const handleBack = () => setCurrentQ(c => c - 1);

  const handleSubmit = async () => {
    setSubmitting(true);
    const elapsedSeconds = Math.round((Date.now() - startTime.current) / 1000);
    const formattedAnswers = questions.map(q => ({
      question_id: q.id,
      question: q.question,
      category: q.category,
      answer: answers[q.id]?.toString() || '',
      rating: q.type === 'rating' ? Number(answers[q.id]) || null : null
    }));

    // Submit survey response
    await base44.functions.invoke('submitFeedbackResponse', {
      survey_id: survey.id,
      survey_date: survey.date,
      answers: formattedAnswers,
      completion_time_seconds: elapsedSeconds,
      dismissed_without_completing: false
    });

    // Save suggestion to UserSuggestion entity
    if (suggestion.trim()) {
      await base44.entities.UserSuggestion.create({
        user_id: user?.id,
        user_name: user?.full_name || 'Anonymous',
        category: suggestionCategory,
        suggestion: suggestion.trim(),
        upvotes: 0,
        upvoted_by: []
      }).catch(() => {});
    }

    // Award +1 contest entry
    try {
      const me = await base44.auth.me();
      await base44.auth.updateMe({ contest_entries: (me?.contest_entries || 0) + 1 });
    } catch (_) {}

    localStorage.setItem(STORAGE_KEY, new Date().toISOString().split('T')[0]);
    setDone(true);
    setTimeout(() => setVisible(false), 2500);
  };

  const handleDismiss = async () => {
    if (survey) {
      await base44.functions.invoke('submitFeedbackResponse', {
        survey_id: survey.id,
        survey_date: survey.date,
        answers: [],
        dismissed_without_completing: true
      });
    }
    setVisible(false);
  };

  const currentAnswered = q ? answers[q.id] !== undefined && answers[q.id] !== '' : false;
  const allSurveyAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined && answers[q.id] !== '');

  if (!visible || !survey) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Daily Platform Survey</h2>
              <p className="text-white/80 text-xs">Help us improve GamerGain — takes ~3 minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold">+1 Contest Entry</Badge>
            <button onClick={handleDismiss} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">
              {isSuggestionStep ? `Step ${totalSteps} of ${totalSteps} — Your Suggestion` : `Question ${currentQ + 1} of ${totalSteps}`}
            </span>
            {q && <Badge variant="outline" className="text-xs">{q.category}</Badge>}
            {isSuggestionStep && <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">Required</Badge>}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content Area */}
        <div className="px-6 py-6 min-h-[240px]">
          {done ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🎉</span>
              </div>
              <div className="text-center">
                <p className="text-green-700 font-semibold text-lg">Thank you! +1 Contest Entry Earned!</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <p className="text-yellow-600 text-sm font-medium">Survey 1 of 2 complete — check your contest entries!</p>
                </div>
              </div>
            </div>

          ) : isSuggestionStep ? (
            /* Suggestion Step */
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                <p className="text-gray-900 font-semibold text-base">What would make GamerGain better for you?</p>
              </div>
              <p className="text-xs text-purple-600 mb-4 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                💡 Top suggestions get turned into tomorrow's survey questions and may be built into the platform!
              </p>
              <select
                value={suggestionCategory}
                onChange={e => setSuggestionCategory(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Textarea
                placeholder="e.g. I'd love to see more puzzle games, or a way to filter surveys by topic..."
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                className="min-h-[110px] resize-none"
              />
              {!suggestion.trim() && (
                <p className="text-xs text-red-500 mt-1.5">A suggestion is required to complete the survey.</p>
              )}
            </div>

          ) : q ? (
            /* Survey Questions */
            <div>
              <p className="text-gray-900 font-semibold text-base mb-5">{q.question}</p>

              {q.type === 'rating' && (
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setAnswer(q.id, n)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers[q.id] === n ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300 text-gray-600'
                      }`}>
                      <Star className={`w-4 h-4 ${answers[q.id] >= n ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multiple_choice' && (
                <div className="flex flex-col gap-2.5">
                  {(q.options || []).map((opt, i) => (
                    <button key={i} onClick={() => setAnswer(q.id, opt)}
                      className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                        answers[q.id] === opt ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium' : 'border-gray-200 hover:border-purple-300 text-gray-700'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'yes_no' && (
                <div className="flex gap-4">
                  {['Yes', 'No'].map(opt => (
                    <button key={opt} onClick={() => setAnswer(q.id, opt)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        answers[q.id] === opt ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300 text-gray-600'
                      }`}>
                      {opt === 'Yes' ? '✅ Yes' : '❌ No'}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <Textarea
                  placeholder="Share your thoughts..."
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Navigation */}
        {!done && (
          <div className="px-6 pb-5 flex items-center justify-between border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={currentQ === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <p className="text-xs text-gray-400">
              {isSuggestionStep ? 'Your suggestion shapes GamerGain' : 'Survey closes at midnight'}
            </p>

            {!isSuggestionStep ? (
              <Button size="sm" onClick={handleNext} disabled={!currentAnswered}
                className="bg-purple-600 hover:bg-purple-700">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit}
                disabled={!suggestion.trim() || !allSurveyAnswered || submitting}
                className="bg-green-600 hover:bg-green-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trophy className="w-4 h-4 mr-1" />}
                Submit & Earn Entry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}