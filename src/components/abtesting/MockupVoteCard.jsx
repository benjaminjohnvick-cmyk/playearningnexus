import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ThumbsUp, CheckCircle, Loader2, Zap, Bot } from 'lucide-react';
import { toast } from 'sonner';

export default function MockupVoteCard({ record, user, onVoted }) {
  const [voting, setVoting] = useState(null);
  const [implementing, setImplementing] = useState(false);

  const myVoteId = record.mockups?.find(m => (m.voter_ids || []).includes(user?.id))?.id;
  const totalVotes = (record.mockups || []).reduce((s, m) => s + (m.votes || 0), 0);

  const castVote = async (mockupId) => {
    if (myVoteId) { toast.error('You already voted on this feature!'); return; }
    setVoting(mockupId);
    try {
      const updatedMockups = record.mockups.map(m =>
        m.id === mockupId
          ? { ...m, votes: (m.votes || 0) + 1, voter_ids: [...(m.voter_ids || []), user.id] }
          : m
      );
      await base44.entities.FeatureMockup.update(record.id, { mockups: updatedMockups, total_mockup_votes: totalVotes + 1 });
      toast.success('Vote cast!');
      onVoted?.();
    } catch { toast.error('Vote failed'); }
    setVoting(null);
  };

  const triggerImplement = async () => {
    setImplementing(true);
    try {
      // First tally
      await base44.functions.invoke('featureMockupPipeline', { action: 'tally_votes', mockup_id: record.id });
      // Then implement
      const res = await base44.functions.invoke('featureMockupPipeline', { action: 'implement_winner', mockup_id: record.id });
      toast.success('AI is implementing the winning mockup!');
      onVoted?.();
    } catch (e) { toast.error(e.message || 'Implementation failed'); }
    setImplementing(false);
  };

  const mockups = record.mockups || [];
  const maxVotes = Math.max(...mockups.map(m => m.votes || 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{totalVotes} votes · {myVoteId ? 'You voted' : 'Vote for your favorite mockup'}</p>
        {record.vote_deadline && (
          <p className="text-xs text-orange-500">Voting ends {new Date(record.vote_deadline).toLocaleDateString()}</p>
        )}
      </div>

      {mockups.map(mockup => {
        const isMyVote = myVoteId === mockup.id;
        const isWinner = record.winning_mockup_id === mockup.id;
        const pct = totalVotes > 0 ? Math.round((mockup.votes || 0) / totalVotes * 100) : 0;

        return (
          <Card key={mockup.id} className={`border-2 transition-all ${isMyVote ? 'border-indigo-400 bg-indigo-50' : isWinner ? 'border-green-400 bg-green-50' : 'border-gray-100'}`}>
            <CardContent className="pt-3 pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900">{mockup.title}</p>
                    {isWinner && <Badge className="bg-green-100 text-green-700 text-xs">🏆 Winner</Badge>}
                    {isMyVote && <Badge className="bg-indigo-100 text-indigo-700 text-xs">Your Vote</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{mockup.description}</p>
                  {mockup.ui_spec && (
                    <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">{mockup.ui_spec}</p>
                  )}
                </div>
                {!myVoteId && record.phase === 'vote_phase' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-shrink-0 hover:border-indigo-400 hover:text-indigo-600" onClick={() => castVote(mockup.id)} disabled={voting === mockup.id}>
                    {voting === mockup.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                    Vote
                  </Button>
                )}
                {isMyVote && <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-1" />}
              </div>
              <div className="flex items-center gap-2">
                <Progress value={(mockup.votes || 0) / maxVotes * 100} className="h-1.5 flex-1" />
                <span className="text-xs font-bold text-gray-600 w-12 text-right">{mockup.votes || 0} ({pct}%)</span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {record.phase === 'vote_phase' && totalVotes >= 10 && !record.winning_mockup_id && (
        <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2" onClick={triggerImplement} disabled={implementing}>
          {implementing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Declare Winner & Implement with AI
        </Button>
      )}

      {record.phase === 'implemented' && record.implementation_spec && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-green-700 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> AI Implementation Plan</p>
          <p className="text-xs text-green-600 whitespace-pre-wrap line-clamp-6">{record.implementation_spec}</p>
        </div>
      )}
    </div>
  );
}