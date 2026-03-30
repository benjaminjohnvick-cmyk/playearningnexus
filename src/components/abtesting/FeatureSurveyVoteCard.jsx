import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, Loader2, Bot, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

const PHASE_COLORS = {
  survey_phase: 'bg-blue-100 text-blue-700',
  mockup_phase: 'bg-yellow-100 text-yellow-700',
  vote_phase: 'bg-purple-100 text-purple-700',
  implementing: 'bg-orange-100 text-orange-700',
  implemented: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function FeatureSurveyVoteCard({ record, user, onUpdate, isAdmin }) {
  const [voting, setVoting] = useState(null);
  const [generating, setGenerating] = useState(false);

  const totalVotes = (record.survey_responses || []).reduce((s, r) => s + (r.votes || 0), 0);
  const alreadyVoted = record.survey_responses?.some(r => (r.voter_ids || []).includes(user?.id));

  const castSurveyVote = async (option) => {
    if (alreadyVoted) { toast.error('Already voted!'); return; }
    setVoting(option);
    try {
      const updated = (record.survey_responses || []).map(r =>
        r.option === option
          ? { ...r, votes: (r.votes || 0) + 1, voter_ids: [...(r.voter_ids || []), user.id] }
          : r
      );
      const total = updated.reduce((s, r) => s + (r.votes || 0), 0);
      const withPct = updated.map(r => ({ ...r, pct: total > 0 ? Math.round(r.votes / total * 100) : 0 }));
      const topResp = [...withPct].sort((a, b) => b.votes - a.votes)[0];
      await base44.entities.FeatureMockup.update(record.id, {
        survey_responses: withPct,
        total_survey_votes: total,
        top_response: topResp?.option,
      });
      toast.success('Vote recorded!');
      onUpdate?.();
    } catch { toast.error('Failed to vote'); }
    setVoting(null);
  };

  const generateMockups = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('featureMockupPipeline', { action: 'generate_mockups', mockup_id: record.id });
      toast.success('AI is generating mockups! Refresh to see them.');
      onUpdate?.();
    } catch (e) { toast.error(e.message || 'Generation failed'); }
    setGenerating(false);
  };

  const maxVotes = Math.max(...(record.survey_responses || []).map(r => r.votes || 0), 1);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`h-1 ${record.phase === 'implemented' ? 'bg-green-500' : record.phase === 'vote_phase' ? 'bg-purple-500' : 'bg-blue-500'}`} />
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-gray-900">{record.feature_name}</p>
            <p className="text-xs text-gray-400">{record.category?.replace(/_/g, ' ')} · {totalVotes} survey votes</p>
          </div>
          <Badge className={PHASE_COLORS[record.phase] || 'bg-gray-100 text-gray-600'} style={{ fontSize: '10px' }}>
            {record.phase?.replace(/_/g, ' ')}
          </Badge>
        </div>

        {record.phase === 'survey_phase' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">{record.survey_question}</p>
            {(record.survey_responses || []).map((r, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Button
                    variant={alreadyVoted ? 'ghost' : 'outline'}
                    size="sm"
                    className={`h-7 text-xs flex-1 justify-start ${alreadyVoted ? 'cursor-default' : 'hover:border-indigo-400 hover:bg-indigo-50'}`}
                    onClick={() => !alreadyVoted && castSurveyVote(r.option)}
                    disabled={!!voting || alreadyVoted}
                  >
                    {voting === r.option ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    {r.option}
                    {alreadyVoted && <span className="ml-auto font-bold text-indigo-600">{r.pct || 0}%</span>}
                  </Button>
                </div>
                {alreadyVoted && <Progress value={(r.votes || 0) / maxVotes * 100} className="h-1" />}
              </div>
            ))}
            {isAdmin && totalVotes >= 5 && (
              <Button size="sm" className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 gap-1 text-xs h-8" onClick={generateMockups} disabled={generating}>
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Generate AI Mockups from Results
              </Button>
            )}
          </div>
        )}

        {record.phase === 'vote_phase' && (
          <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
            <Bot className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <p className="text-xs text-purple-700">{record.mockups?.length || 0} mockups ready for voting · {record.total_mockup_votes || 0} votes cast</p>
            <ChevronRight className="w-3.5 h-3.5 text-purple-400 ml-auto" />
          </div>
        )}

        {record.phase === 'implemented' && (
          <div className="p-2 bg-green-50 rounded-lg text-xs text-green-700 font-medium">
            ✅ "{record.winning_mockup_title}" implemented by AI
          </div>
        )}
      </CardContent>
    </Card>
  );
}