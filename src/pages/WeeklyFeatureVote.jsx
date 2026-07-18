import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Sparkles, LayoutGrid, CheckCircle2, Loader2, Vote, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_META = {
  game: { icon: Gamepad2, label: 'New Game', color: 'bg-red-100 text-red-700' },
  feature: { icon: Sparkles, label: 'Feature', color: 'bg-purple-100 text-purple-700' },
  ui_ux: { icon: LayoutGrid, label: 'UI / UX', color: 'bg-blue-100 text-blue-700' },
};

export default function WeeklyFeatureVote() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: survey, isLoading } = useQuery({
    queryKey: ['activeFeatureVote'],
    queryFn: async () => {
      const rows = await base44.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 1);
      return rows[0] || null;
    },
    enabled: !!user,
  });

  const alreadyVoted = !!(survey && user && (survey.responder_ids || []).includes(user.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke('submitFeatureVote', {
      survey_id: survey.id,
      candidate_ids: [...selected],
    }),
    onSuccess: (res) => {
      const reward = res?.data?.reward ?? 0.1;
      toast.success(`Thanks for voting! $${Number(reward).toFixed(2)} credited to your balance.`);
      qc.invalidateQueries({ queryKey: ['activeFeatureVote'] });
      setSelected(new Set());
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e?.message || 'Could not submit your vote.';
      toast.error(msg);
      if (/already voted/i.test(msg)) qc.invalidateQueries({ queryKey: ['activeFeatureVote'] });
    },
  });

  if (!user || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Vote className="w-4 h-4" /> Weekly Feature Vote
          </div>
          <h1 className="text-3xl font-black text-gray-900">Help decide what we build next</h1>
          <p className="text-gray-500 mt-1">Your vote directly shapes the roadmap — and pays.</p>
        </div>

        {!survey ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              <Vote className="w-14 h-14 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No active vote right now.</p>
              <p className="text-sm mt-1">A new survey opens every week — check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {!alreadyVoted && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-800">This week's vote is open — it takes 30 seconds and pays <strong>${Number(survey.reward_amount || 0.1).toFixed(2)}</strong>. Voting is optional.</p>
              </div>
            )}

            {alreadyVoted ? (
              <Card className="border-green-200 bg-green-50/40">
                <CardContent className="py-14 text-center">
                  <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-bold text-gray-900">You're all set for this week!</p>
                  <p className="text-sm text-gray-600 mt-1">Your vote was recorded and your reward credited. Results roll into the roadmap when voting closes.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{survey.title}</span>
                    <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />{Number(survey.reward_amount || 0.1).toFixed(2)}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-500">{survey.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Select everything you'd like to see built</p>
                  {(survey.candidates || []).map((c) => {
                    const meta = TYPE_META[c.type] || TYPE_META.feature;
                    const Icon = meta.icon;
                    const isSel = selected.has(c.candidate_id);
                    return (
                      <button
                        key={c.candidate_id}
                        type="button"
                        onClick={() => toggle(c.candidate_id)}
                        className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${isSel ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-purple-200'}`}
                      >
                        <div className={`p-2 rounded-lg ${meta.color} flex-shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{c.title}</span>
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          </div>
                          {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${isSel ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                          {isSel && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}

                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 h-11 text-base"
                    disabled={selected.size === 0 || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <Vote className="w-4 h-4 mr-2" />}
                    Submit vote &amp; earn ${Number(survey.reward_amount || 0.1).toFixed(2)}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
