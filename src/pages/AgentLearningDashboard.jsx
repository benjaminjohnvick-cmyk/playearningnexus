import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, TrendingDown, Pin, PinOff, Ban, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// INCREMENT 5 — Agent Learning dashboard. Shows what the agents are learning (per-agent
// success trends + the platform insight) and lets an admin PIN a good lesson or VETO a bad
// one so a wrong lesson can't quietly degrade an agent.
export default function AgentLearningDashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['learning-insights'],
    queryFn: () => base44.functions.invoke('learningInsights', {}).then((r) => r.data ?? r),
    refetchInterval: 60000,
  });
  const insights = data ?? {};
  const perAgent = insights.per_agent ?? [];
  const lessons = insights.lessons ?? [];

  const manage = useMutation({
    mutationFn: ({ id, action }) => base44.functions.invoke('manageLesson', { lesson_id: id, action }),
    onSuccess: (_, v) => { toast.success(`Lesson ${v.action}ed`); qc.invalidateQueries(['learning-insights']); },
    onError: (e) => toast.error(e?.message || 'Action failed'),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">AI Learning</h1>
            <p className="text-sm text-gray-500">What the agents are learning from real outcomes — and your controls over it.</p>
          </div>
        </div>

        {isLoading && <p className="text-gray-500">Loading…</p>}

        {insights.platform_insight && (
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="py-4 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-900"><strong>Platform insight (shared with every agent):</strong> {insights.platform_insight}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Per-agent performance (30 days)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {perAgent.length === 0 && <p className="text-sm text-gray-500">No learning data yet — it fills in as agents run.</p>}
            {perAgent.map((a) => (
              <div key={a.agent} className="flex items-center gap-3 py-2 border-b last:border-0">
                {a.success_rate >= 60 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                <span className="font-mono text-sm text-gray-800 flex-1 truncate">{a.agent}</span>
                <Badge className={a.success_rate >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>{a.success_rate}% success</Badge>
                <span className="text-xs text-gray-400 w-24 text-right">{a.runs} runs</span>
                <span className="text-xs text-gray-400 w-28 text-right">{a.grounded_share}% grounded</span>
                <span className="text-xs text-gray-400 w-24 text-right">${a.avg_cost_usd}/run</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Lessons (pin the good, veto the bad)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lessons.filter((l) => l.note).length === 0 && <p className="text-sm text-gray-500">No distilled lessons yet.</p>}
            {lessons.filter((l) => l.note).map((l) => (
              <div key={l.id} className={`rounded-xl border p-3 ${l.vetoed ? 'opacity-50 bg-gray-50' : l.pinned ? 'border-indigo-300 bg-indigo-50/40' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-500">{l.agent}</span>
                  {l.pinned && <Badge className="bg-indigo-100 text-indigo-700 text-xs"><Pin className="w-3 h-3 mr-0.5" />pinned</Badge>}
                  {l.vetoed && <Badge className="bg-gray-200 text-gray-600 text-xs">vetoed</Badge>}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => manage.mutate({ id: l.id, action: l.pinned ? 'unpin' : 'pin' })}>
                      {l.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => manage.mutate({ id: l.id, action: l.vetoed ? 'unveto' : 'veto' })}>
                      {l.vetoed ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4 text-red-500" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-1">{l.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
