import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ThumbsUp, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = ['features', 'games', 'surveys', 'products', 'ui_ux', 'payouts', 'referrals', 'other'];
const CATEGORY_EMOJI = { features: '✨', games: '🎮', surveys: '📋', products: '🛍️', ui_ux: '🎨', payouts: '💰', referrals: '👥', other: '💬' };

export default function SuggestionBoard({ user }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('features');
  const queryClient = useQueryClient();

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const res = await base44.entities.UserSuggestion.list('-upvotes', 20);
      return res;
    },
    enabled: expanded,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.UserSuggestion.create({
        user_id: user?.id,
        user_name: user?.full_name || 'Anonymous',
        category,
        suggestion: text.trim(),
        upvotes: 0,
        upvoted_by: []
      });
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries(['suggestions']);
    }
  });

  const upvoteMutation = useMutation({
    mutationFn: async (suggestion) => {
      if (!user?.id || (suggestion.upvoted_by || []).includes(user.id)) return;
      await base44.entities.UserSuggestion.update(suggestion.id, {
        upvotes: (suggestion.upvotes || 0) + 1,
        upvoted_by: [...(suggestion.upvoted_by || []), user.id]
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['suggestions'])
  });

  return (
    <div className="border border-purple-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-sm">Community Suggestions</p>
            <p className="text-xs text-gray-500">Top suggestions become tomorrow's survey questions</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* Submit form */}
          {user ? (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${category === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                  >
                    {CATEGORY_EMOJI[c]} {c.replace('_', '/')}
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="What would make GamerGain better? Your idea may appear in tomorrow's survey!"
                value={text}
                onChange={e => setText(e.target.value)}
                className="min-h-[70px] resize-none text-sm"
              />
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!text.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Submit Suggestion
              </Button>
              {submitMutation.isSuccess && (
                <p className="text-xs text-green-600">✅ Suggestion submitted! Watch for it in tomorrow's survey.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-center text-gray-500 py-2">Sign in to submit and vote on suggestions.</p>
          )}

          {/* Suggestion list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {suggestions.map(s => {
              const hasUpvoted = user && (s.upvoted_by || []).includes(user.id);
              return (
                <div key={s.id} className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100">
                  <button
                    onClick={() => !hasUpvoted && upvoteMutation.mutate(s)}
                    disabled={hasUpvoted || !user}
                    className={`flex flex-col items-center gap-0.5 flex-shrink-0 min-w-[36px] rounded-lg py-1.5 px-1 border transition-all ${hasUpvoted ? 'bg-purple-50 border-purple-300 text-purple-600' : 'bg-white border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-500'}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{s.upvotes || 0}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={`text-xs border-0 ${s.status === 'added_to_survey' ? 'bg-green-100 text-green-700' : s.status === 'implemented' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_EMOJI[s.category]} {s.category?.replace('_', '/')}
                      </Badge>
                      {s.status === 'added_to_survey' && <Badge className="text-xs bg-green-50 text-green-600 border-green-200">In Survey ✓</Badge>}
                      {s.status === 'implemented' && <Badge className="text-xs bg-blue-50 text-blue-600 border-blue-200">Implemented! 🚀</Badge>}
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{s.suggestion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.user_name || 'Anonymous'}</p>
                  </div>
                </div>
              );
            })}
            {suggestions.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">No suggestions yet — be the first!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}