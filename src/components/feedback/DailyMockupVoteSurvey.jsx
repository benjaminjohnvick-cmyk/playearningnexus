import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, Trophy, ChevronRight, ChevronLeft, Loader2, Layers, CheckCircle2, ImageOff } from 'lucide-react';

const STORAGE_KEY = 'gg_mockup_vote_date';

export default function DailyMockupVoteSurvey({ user }) {
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [votes, setVotes] = useState({}); // { comparison_id: 'a' | 'b' }
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    // Delay 90s after feedback survey so modals don't overlap
    const t = setTimeout(() => {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed === today) return;
      loadSurvey();
    }, 90000);
    return () => clearTimeout(t);
  }, [user]);

  const loadSurvey = async () => {
    try {
      const res = await base44.functions.invoke('submitMockupVote', { action: 'get_today' });
      const { survey: s, already_completed } = res.data || {};
      if (!s || already_completed) {
        const today = new Date().toISOString().split('T')[0];
        if (already_completed) localStorage.setItem(STORAGE_KEY, today);
        return;
      }
      setSurvey(s);
      setVisible(true);
    } catch (e) {
      console.error('MockupVoteSurvey load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const comparisons = survey?.comparisons || [];
  const cmp = comparisons[currentIdx];
  const progress = comparisons.length ? ((currentIdx) / comparisons.length) * 100 : 0;
  const currentVote = cmp ? votes[cmp.id] : null;
  const allVoted = comparisons.length > 0 && comparisons.every(c => votes[c.id]);

  const vote = (choice) => {
    if (!cmp) return;
    setVotes(v => ({ ...v, [cmp.id]: choice }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const voteList = comparisons.map(c => ({ comparison_id: c.id, choice: votes[c.id] })).filter(v => v.choice);
    await base44.functions.invoke('submitMockupVote', {
      action: 'vote',
      survey_id: survey.id,
      votes: voteList
    });
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
    setDone(true);
    setSubmitting(false);
    setTimeout(() => setVisible(false), 3500);
  };

  const handleDismiss = () => setVisible(false);

  if (!visible || !survey) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Daily Design Vote — Survey 2 of 2</h2>
              <p className="text-white/80 text-xs">Vote on mockups • The winner gets built into GamerGain!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold">+1 Contest Entry</Badge>
            <button onClick={handleDismiss} className="text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Design {currentIdx + 1} of {comparisons.length}</span>
            {cmp && <Badge variant="outline" className="text-xs capitalize">{cmp.category?.replace('_', ' ')}</Badge>}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-yellow-500" />
              </div>
              <p className="text-gray-900 font-bold text-xl">You voted! +1 Contest Entry Earned!</p>
              <p className="text-gray-500 text-sm text-center">Your votes help shape GamerGain. The winning designs will be built this week.</p>
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Both daily surveys complete — maximum contest entries earned!</p>
              </div>
            </div>
          ) : cmp ? (
            <div>
              {/* Feature context */}
              <div className="mb-4">
                <h3 className="text-gray-900 font-bold text-base">{cmp.feature_name}</h3>
                <p className="text-gray-500 text-sm mt-0.5">{cmp.description}</p>
                {cmp.source_feedback && (
                  <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2.5 py-1.5 mt-2 border border-purple-100">
                    💬 Based on user feedback: "{cmp.source_feedback}"
                  </p>
                )}
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {['a', 'b'].map(side => {
                  const option = side === 'a' ? cmp.option_a : cmp.option_b;
                  const isSelected = currentVote === side;
                  return (
                    <button
                      key={side}
                      onClick={() => vote(side)}
                      className={`relative rounded-2xl border-3 overflow-hidden transition-all text-left ${
                        isSelected
                          ? 'border-red-500 ring-2 ring-red-300 shadow-lg shadow-red-100'
                          : 'border-gray-200 hover:border-red-300 hover:shadow-md'
                      }`}
                      style={{ border: isSelected ? '3px solid #ef4444' : '2px solid #e5e7eb' }}
                    >
                      {/* Mockup image */}
                      <div className="relative w-full aspect-video bg-gray-100 overflow-hidden">
                        {option?.image_url ? (
                          <img
                            src={option.image_url}
                            alt={option.title}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200" style={{ display: option?.image_url ? 'none' : 'flex' }}>
                          <ImageOff className="w-8 h-8 text-gray-400" />
                        </div>
                        {/* Selected overlay */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                            <div className="bg-red-500 text-white rounded-full p-1.5">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                          </div>
                        )}
                        {/* Option label */}
                        <div className="absolute top-2 left-2">
                          <Badge className={`font-bold text-xs ${isSelected ? 'bg-red-500 text-white' : 'bg-white text-gray-700 shadow'}`}>
                            Option {side.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      {/* Text details */}
                      <div className="p-3">
                        <p className="font-semibold text-sm text-gray-900">{option?.title}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{option?.description}</p>
                        <div className={`mt-2.5 w-full py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                          isSelected ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isSelected ? '✓ Your Vote' : `Vote for Option ${side.toUpperCase()}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-6 pb-5 flex items-center justify-between flex-shrink-0 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => i - 1)} disabled={currentIdx === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <p className="text-xs text-gray-400">Votes are final · Winner gets implemented</p>
            {currentIdx < comparisons.length - 1 ? (
              <Button size="sm" onClick={() => setCurrentIdx(i => i + 1)} disabled={!currentVote}
                className="bg-red-600 hover:bg-red-700">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={!allVoted || submitting}
                className="bg-green-600 hover:bg-green-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trophy className="w-4 h-4 mr-1" />}
                Submit Votes
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}