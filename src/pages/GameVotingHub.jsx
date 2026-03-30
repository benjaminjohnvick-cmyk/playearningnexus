import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2, Users, Star, Trophy, Loader2, Plus, Bot, Zap,
  ThumbsUp, CheckCircle, Clock, Send, BarChart2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIES = ['puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];
const PLATFORMS = ['ios', 'android', 'web'];

const STATUS_COLORS = {
  pending_review: 'bg-yellow-100 text-yellow-700',
  in_survey: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  waitlisted: 'bg-gray-100 text-gray-600',
};

export default function GameVotingHub() {
  const [user, setUser] = useState(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyForm, setApplyForm] = useState({
    company_name: '', contact_name: '', contact_email: '', website: '',
    game_title: '', game_description: '', game_category: 'casual',
    game_platform: ['web'], demo_url: '', why_gamergain: '', monetization_model: 'free',
  });
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['game-vote-surveys'],
    queryFn: () => base44.entities.GameVoteSurvey.list('-created_date', 20),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['developer-applications'],
    queryFn: () => base44.entities.DeveloperApplication.list('-created_date', 50),
    enabled: user?.role === 'admin',
  });

  const activeSurveys = surveys.filter(s => s.status === 'active');
  const closedSurveys = surveys.filter(s => s.status === 'closed');

  const submitApplicationMutation = useMutation({
    mutationFn: () => base44.entities.DeveloperApplication.create({ ...applyForm, applied_user_id: user?.id }),
    onSuccess: () => {
      qc.invalidateQueries(['developer-applications']);
      setShowApplyForm(false);
      toast.success('Application submitted! Our AI will review it shortly.');
    },
  });

  const generateSurveysMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gameVotingPipeline', { action: 'generate_surveys' }),
    onSuccess: (res) => {
      qc.invalidateQueries(['game-vote-surveys']);
      toast.success(`Generated ${res.data?.surveys_created || 0} surveys!`);
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gameVotingPipeline', { action: 'ai_review_applications' }),
    onSuccess: (res) => {
      qc.invalidateQueries(['developer-applications']);
      toast.success(`AI reviewed ${res.data?.reviewed || 0} applications`);
    },
  });

  const applyResultsMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('gameVotingPipeline', { action: 'apply_results', survey_id: id }),
    onSuccess: (res) => {
      qc.invalidateQueries(['game-vote-surveys', 'developer-applications']);
      toast.success(`Applied! ${res.data?.applied || 0} games ranked and added.`);
    },
  });

  const VoteSurveyCard = ({ survey }) => {
    const [voted, setVoted] = useState(null);
    const [voting, setVoting] = useState(null);
    const total = survey.options?.reduce((s, o) => s + (o.votes || 0), 0) || 0;
    const myVote = survey.options?.find(o => (o.voter_ids || []).includes(user?.id));
    const maxVotes = Math.max(...(survey.options || []).map(o => o.votes || 0), 1);

    const castVote = async (optId) => {
      if (myVote || !user) return;
      setVoting(optId);
      const updated = survey.options.map(o =>
        o.id === optId ? { ...o, votes: (o.votes || 0) + 1, voter_ids: [...(o.voter_ids || []), user.id] } : o
      );
      await base44.entities.GameVoteSurvey.update(survey.id, { options: updated, total_votes: total + 1 });
      qc.invalidateQueries(['game-vote-surveys']);
      toast.success('Vote cast!');
      setVoting(null);
    };

    return (
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{survey.title}</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{survey.description}</p>
            </div>
            <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">
              {total} votes
            </Badge>
          </div>
          {survey.closes_at && (
            <p className="text-xs text-orange-500 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" /> Closes {format(new Date(survey.closes_at), 'MMM d, yyyy')}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(survey.options || []).map(opt => {
            const isMyVote = myVote?.id === opt.id;
            const pct = total > 0 ? Math.round((opt.votes || 0) / total * 100) : 0;
            const showResults = !!myVote;
            return (
              <div key={opt.id} className={`rounded-xl border-2 p-3 transition-all ${isMyVote ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  {opt.image_url && (
                    <img src={opt.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                      {isMyVote && <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    {opt.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{opt.description}</p>}
                    {showResults && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={(opt.votes || 0) / maxVotes * 100} className="h-1.5 flex-1" />
                        <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
                      </div>
                    )}
                  </div>
                  {!myVote && user && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-shrink-0" onClick={() => castVote(opt.id)} disabled={voting === opt.id}>
                      {voting === opt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                      Vote
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {user?.role === 'admin' && survey.status === 'active' && total >= 5 && (
            <Button className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-xs h-8 gap-1" onClick={() => applyResultsMutation.mutate(survey.id)} disabled={applyResultsMutation.isPending}>
              {applyResultsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Apply Results → Rank & Add Games
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-bold mb-3">
            <Gamepad2 className="w-4 h-4" /> Community Game Voting
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
            You Decide What Gets <span className="text-indigo-600">Added</span>
          </h1>
          <p className="text-gray-500">Vote on developer applications & game types. Top-ranked games get added to Featured & Library first.</p>
        </div>

        {/* Admin controls */}
        {user?.role === 'admin' && (
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardContent className="pt-4 flex flex-wrap gap-2">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1" onClick={() => aiReviewMutation.mutate()} disabled={aiReviewMutation.isPending}>
                {aiReviewMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                AI Review Applications
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1" onClick={() => generateSurveysMutation.mutate()} disabled={generateSurveysMutation.isPending}>
                {generateSurveysMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Generate Surveys
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="vote">
          <TabsList className="w-full">
            <TabsTrigger value="vote" className="flex-1 gap-1"><Star className="w-4 h-4" /> Vote Now</TabsTrigger>
            <TabsTrigger value="apply" className="flex-1 gap-1"><Send className="w-4 h-4" /> Apply as Developer</TabsTrigger>
            {user?.role === 'admin' && <TabsTrigger value="admin" className="flex-1 gap-1"><BarChart2 className="w-4 h-4" /> Admin</TabsTrigger>}
          </TabsList>

          {/* VOTE TAB */}
          <TabsContent value="vote" className="space-y-4 mt-4">
            {activeSurveys.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Gamepad2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">No active votes right now</p>
                <p className="text-sm mt-1">Check back soon — new developer applications are being reviewed!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeSurveys.map(s => <VoteSurveyCard key={s.id} survey={s} />)}
              </div>
            )}

            {closedSurveys.length > 0 && (
              <div className="pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Past Votes (Results Applied)</p>
                <div className="space-y-2">
                  {closedSurveys.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border text-sm">
                      <span className="text-gray-700">{s.title}</span>
                      <Badge className="bg-gray-100 text-gray-500 text-xs">{s.total_votes} votes · Closed</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* APPLY TAB */}
          <TabsContent value="apply" className="mt-4">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white">
                <h2 className="text-xl font-bold mb-1">Host Your Game on GamerGain</h2>
                <p className="text-sm text-indigo-100">Submit your application. Our AI reviews it, then our community votes. Top-voted games get added to Featured automatically.</p>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  {[['1. Apply', 'Submit your game details'], ['2. AI Reviews', 'Scored for platform fit'], ['3. Community Votes', 'Top games go live']].map(([title, desc]) => (
                    <div key={title} className="bg-white/10 rounded-xl p-2">
                      <p className="font-bold text-sm">{title}</p>
                      <p className="text-xs text-indigo-200 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {!showApplyForm ? (
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => setShowApplyForm(true)}>
                  <Plus className="w-4 h-4" /> Apply to Host Your Game
                </Button>
              ) : (
                <Card className="border-2 border-indigo-200">
                  <CardHeader><CardTitle className="text-base">Developer Application</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      {[['company_name', 'Company / Studio Name'], ['contact_name', 'Your Name'], ['contact_email', 'Email'], ['website', 'Website (optional)']].map(([field, label]) => (
                        <div key={field}>
                          <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
                          <Input value={applyForm[field]} onChange={e => setApplyForm(f => ({ ...f, [field]: e.target.value }))} className="text-sm h-8" />
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Game Title</p>
                      <Input value={applyForm.game_title} onChange={e => setApplyForm(f => ({ ...f, game_title: e.target.value }))} className="text-sm" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Game Description</p>
                      <Textarea value={applyForm.game_description} onChange={e => setApplyForm(f => ({ ...f, game_description: e.target.value }))} className="text-sm h-16" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Category</p>
                        <Select value={applyForm.game_category} onValueChange={v => setApplyForm(f => ({ ...f, game_category: v }))}>
                          <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Monetization</p>
                        <Select value={applyForm.monetization_model} onValueChange={v => setApplyForm(f => ({ ...f, monetization_model: v }))}>
                          <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{['free', 'paid', 'freemium', 'subscription'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Demo URL</p>
                      <Input value={applyForm.demo_url} onChange={e => setApplyForm(f => ({ ...f, demo_url: e.target.value }))} placeholder="https://..." className="text-sm h-8" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Why GamerGain?</p>
                      <Textarea value={applyForm.why_gamergain} onChange={e => setApplyForm(f => ({ ...f, why_gamergain: e.target.value }))} placeholder="Why do you want to host on GamerGain?" className="text-sm h-14" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowApplyForm(false)}>Cancel</Button>
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => submitApplicationMutation.mutate()} disabled={!applyForm.game_title || !applyForm.contact_email || submitApplicationMutation.isPending}>
                        {submitApplicationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Application'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ADMIN TAB */}
          {user?.role === 'admin' && (
            <TabsContent value="admin" className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Pending Review', value: applications.filter(a => a.status === 'pending_review').length, color: 'text-yellow-600' },
                  { label: 'In Survey', value: applications.filter(a => a.status === 'in_survey').length, color: 'text-blue-600' },
                  { label: 'Approved', value: applications.filter(a => a.status === 'approved').length, color: 'text-green-600' },
                ].map(s => (
                  <Card key={s.label} className="border-0 shadow-sm">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                {applications.map(app => (
                  <Card key={app.id} className="border-0 shadow-sm">
                    <CardContent className="pt-3 pb-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{app.game_title}</p>
                          <Badge className={STATUS_COLORS[app.status] || 'bg-gray-100'} style={{ fontSize: '10px' }}>{app.status?.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-gray-400">{app.company_name} · {app.game_category}</p>
                        {app.ai_review_notes && <p className="text-xs text-blue-600 mt-0.5 truncate"><Bot className="w-3 h-3 inline mr-0.5" />{app.ai_review_notes}</p>}
                      </div>
                      {app.ai_review_score != null && (
                        <div className="text-center flex-shrink-0">
                          <p className={`text-lg font-black ${app.ai_review_score >= 70 ? 'text-green-600' : app.ai_review_score >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>{app.ai_review_score}</p>
                          <p className="text-xs text-gray-400">AI Score</p>
                        </div>
                      )}
                      {app.survey_rank && (
                        <div className="text-center flex-shrink-0">
                          <p className="text-lg font-black text-indigo-600">#{app.survey_rank}</p>
                          <p className="text-xs text-gray-400">{app.survey_vote_count} votes</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}