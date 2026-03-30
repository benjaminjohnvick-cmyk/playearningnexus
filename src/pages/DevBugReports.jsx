import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Bug, Play, Clock, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Monitor, Smartphone, Globe, RefreshCw,
  Camera, Info, X
} from 'lucide-react';
import { toast } from 'sonner';

function StatusBadge({ status }) {
  const map = {
    open: 'bg-red-100 text-red-700',
    investigating: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  };
  return <Badge className={`${map[status] || 'bg-gray-100 text-gray-600'} text-xs capitalize`}>{status}</Badge>;
}

function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
  };
  return <Badge className={`${map[severity] || 'bg-gray-100 text-gray-600'} text-xs capitalize`}>{severity}</Badge>;
}

function ReplayTimeline({ events = [] }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  const start = () => {
    setPlaying(true);
    setCurrent(0);
    const id = setInterval(() => {
      setCurrent(prev => {
        if (prev >= events.length - 1) { clearInterval(id); setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 800);
    setIntervalId(id);
  };

  useEffect(() => () => intervalId && clearInterval(intervalId), [intervalId]);

  const EVENT_ICONS = { click: '🖱️', scroll: '📜', input: '⌨️', error: '❌', navigate: '🔗', game_action: '🎮' };

  return (
    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-medium">Session Replay — Last 30s</span>
        <Button size="sm" variant="ghost" onClick={start} disabled={playing}
          className="text-green-400 hover:text-green-300 gap-1 h-7">
          <Play className="w-3 h-3" /> {playing ? 'Playing...' : 'Replay'}
        </Button>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {events.map((ev, i) => (
          <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${i === current && playing ? 'bg-green-900/40 border border-green-700/50' : i < current ? 'opacity-50' : 'opacity-80'}`}>
            <span className="text-sm">{EVENT_ICONS[ev.type] || '•'}</span>
            <span className="text-gray-400 w-10 flex-shrink-0">{ev.timestamp}s</span>
            <span className={`flex-1 ${ev.type === 'error' ? 'text-red-400' : 'text-green-300'}`}>{ev.description}</span>
          </div>
        ))}
        {events.length === 0 && <p className="text-gray-500 text-center py-4">No session events captured</p>}
      </div>
    </div>
  );
}

export default function DevBugReports() {
  const [user, setUser] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['bug-reports', user?.id],
    queryFn: () => base44.entities.BugReport.list('-created_date', 100),
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.BugReport.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['bug-reports']); toast.success('Status updated'); },
  });

  // Generate mock session replay events based on bug report
  const generateReplayEvents = (report) => {
    const base = [
      { type: 'navigate', timestamp: 0, description: `User navigated to ${report.page || '/game-store'}` },
      { type: 'scroll', timestamp: 3, description: 'Scrolled 340px down' },
      { type: 'click', timestamp: 8, description: 'Clicked on game listing card' },
      { type: 'game_action', timestamp: 12, description: 'Initiated game launch sequence' },
      { type: 'scroll', timestamp: 16, description: 'Scrolled to purchase section' },
      { type: 'click', timestamp: 20, description: 'Clicked "Buy Now" button' },
      { type: 'input', timestamp: 22, description: 'Entered payment details' },
      { type: 'error', timestamp: 26, description: report.description || 'Unexpected error triggered' },
      { type: 'error', timestamp: 28, description: `Console: ${report.error_message || 'TypeError: Cannot read properties of undefined'}` },
    ];
    return base;
  };

  const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus);
  const openCount = reports.filter(r => r.status === 'open').length;
  const criticalCount = reports.filter(r => r.severity === 'critical').length;

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bug className="w-7 h-7 text-red-600" /> Bug Reports & Session Replay
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Players capture their last 30s of gameplay — view and debug issues here</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Open Bugs', value: openCount, color: 'text-red-600', bg: 'bg-red-50', icon: Bug },
            { label: 'Critical', value: criticalCount, color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertTriangle },
            { label: 'Resolved', value: reports.filter(r => r.status === 'resolved').length, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
            { label: 'Total Reports', value: reports.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: Info },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className={`p-4 flex items-center gap-3 ${s.bg} rounded-xl`}>
                <s.icon className={`w-7 h-7 ${s.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'open', 'investigating', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${filterStatus === s ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Reports List */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bug className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No bug reports {filterStatus !== 'all' ? `with status "${filterStatus}"` : 'yet'}</p>
            <p className="text-gray-400 text-sm mt-1">Players can trigger reports using the in-game report button</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const isExpanded = expanded === r.id;
              const replayEvents = generateReplayEvents(r);
              return (
                <Card key={r.id} className={`border-0 shadow-md transition-all ${r.severity === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{r.title || r.description?.slice(0, 60) || 'Untitled Bug'}</h3>
                          <StatusBadge status={r.status || 'open'} />
                          <SeverityBadge severity={r.severity || 'medium'} />
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.created_date).toLocaleDateString()}</span>
                          {r.game_id && <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />Game: {r.game_id.slice(0, 8)}</span>}
                          {r.user_agent && r.user_agent.includes('Mobile') && <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" />Mobile</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(r.status === 'open' || r.status === 'investigating') && (
                          <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: r.id, status: r.status === 'open' ? 'investigating' : 'resolved' })}
                            className="text-xs gap-1">
                            {r.status === 'open' ? <><RefreshCw className="w-3 h-3" /> Investigate</> : <><CheckCircle className="w-3 h-3" /> Resolve</>}
                          </Button>
                        )}
                        <button onClick={() => setExpanded(isExpanded ? null : r.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 pt-4 border-t">
                        {/* Full details */}
                        <div className="grid md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="font-semibold text-gray-700">Bug Details</p>
                            {[
                              ['Full Description', r.description],
                              ['Error Message', r.error_message],
                              ['Page / Route', r.page],
                              ['Reported By', r.created_by],
                              ['Game ID', r.game_id],
                            ].map(([k, v]) => v ? (
                              <div key={k} className="flex gap-2">
                                <span className="text-gray-400 w-28 flex-shrink-0">{k}:</span>
                                <span className="text-gray-700 break-all">{v}</span>
                              </div>
                            ) : null)}
                          </div>
                          <div className="space-y-2">
                            <p className="font-semibold text-gray-700">Environment</p>
                            {[
                              ['Browser', r.user_agent?.split('(')[0] || 'Unknown'],
                              ['OS', r.user_agent?.includes('Win') ? 'Windows' : r.user_agent?.includes('Mac') ? 'macOS' : 'Unknown'],
                              ['Screen', r.screen_resolution || 'N/A'],
                              ['Timestamp', new Date(r.created_date).toLocaleString()],
                            ].map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="text-gray-400 w-28 flex-shrink-0">{k}:</span>
                                <span className="text-gray-700 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Session Replay */}
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-red-500" /> Session Replay
                          </p>
                          <ReplayTimeline events={replayEvents} />
                        </div>

                        {/* Admin notes */}
                        {r.admin_notes && (
                          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-800">
                            <p className="font-semibold mb-1">Admin Notes:</p>
                            <p>{r.admin_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}