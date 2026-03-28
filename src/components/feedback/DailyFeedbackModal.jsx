import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronRight, ChevronLeft, X, ClipboardList, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'gg_feedback_dismissed_date';

export default function DailyFeedbackModal({ user }) {
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === today) return; // Already fully completed today
    loadSurvey();
  }, [user]);

  const loadSurvey = async () => {
    try {
      const res = await base44.functions.invoke('getTodayFeedbackSurvey', {});
      const { survey: s, already_completed } = res.data;
      if (!s || already_completed) {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(STORAGE_KEY, today);
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
  const progress = questions.length ? ((currentQ) / questions.length) * 100 : 0;
  const q = questions[currentQ];

  const setAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) setCurrentQ(c => c + 1);
  };
  const handleBack = () => {
    if (currentQ > 0) setCurrentQ(c => c - 1);
  };

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

    await base44.functions.invoke('submitFeedbackResponse', {
      survey_id: survey.id,
      survey_date: survey.date,
      answers: formattedAnswers,
      completion_time_seconds: elapsedSeconds,
      dismissed_without_completing: false
    });

    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
    setDone(true);
    setTimeout(() => setVisible(false), 2500);
  };

  const handleDismiss = async () => {
    // Mark as dismissed (will show again next session until completed)
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
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined && answers[q.id] !== '');

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
          <button onClick={handleDismiss} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Question {Math.min(currentQ + 1, questions.length)} of {questions.length}</span>
            <Badge variant="outline" className="text-xs">{q?.category}</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Area */}
        <div className="px-6 py-6 min-h-[240px]">
          {done ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🎉</span>
              </div>
              <p className="text-green-700 font-semibold text-lg">Thank you for your feedback!</p>
              <p className="text-gray-500 text-sm">Your responses help us make GamerGain better for you.</p>
            </div>
          ) : q ? (
            <div>
              <p className="text-gray-900 font-semibold text-base mb-5">{q.question}</p>

              {/* Rating */}
              {q.type === 'rating' && (
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, n)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers[q.id] === n
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-purple-300 text-gray-600'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${answers[q.id] >= n ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {/* Multiple Choice */}
              {q.type === 'multiple_choice' && (
                <div className="flex flex-col gap-2.5">
                  {(q.options || []).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                        answers[q.id] === opt
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                          : 'border-gray-200 hover:border-purple-300 text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Yes/No */}
              {q.type === 'yes_no' && (
                <div className="flex gap-4">
                  {['Yes', 'No'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        answers[q.id] === opt
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-purple-300 text-gray-600'
                      }`}
                    >
                      {opt === 'Yes' ? '✅ Yes' : '❌ No'}
                    </button>
                  ))}
                </div>
              )}

              {/* Text */}
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
          <div className="px-6 pb-5 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={currentQ === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <p className="text-xs text-gray-400">Survey closes when all respond or at midnight</p>

            {currentQ < questions.length - 1 ? (
              <Button size="sm" onClick={handleNext} disabled={!currentAnswered}
                className="bg-purple-600 hover:bg-purple-700">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={!allAnswered || submitting}
                className="bg-green-600 hover:bg-green-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Submit Survey
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}