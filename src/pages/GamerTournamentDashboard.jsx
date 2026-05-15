import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Trophy, Users, Zap, DollarSign, Loader2, Plus, Play,
  Crown, Target, Clock, CheckCircle, Shield, AlertCircle, Swords
} from 'lucide-react';
import { toast } from 'sonner';

const PRIZE_TIERS = [
  { place: '1st', pct: 50, icon: '🥇', color: 'text-yellow-600' },
  { place: '2nd', pct: 30, icon: '🥈', color: 'text-gray-500' },
  { place: '3rd', pct: 20, icon: '🥉', color: 'text-amber-700' },
];

export default function GamerTournamentDashboard() {
  const [user, setUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [distributing, setDistributing] = useState(null);
  const [form, setForm] = useState({ name: '', prizePool: '100', maxPlayers: '16', entryFee: '5', gameType: 'survey_speed' });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['dev-tournaments'],
    queryFn: () => base44.entities.Tournament.list('-created_date', 50),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['dev-tourney-participants'],
    queryFn: () => base44.entities.TournamentParticipant.list('-created_date', 200),
    enabled: !!user,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['dev-tourney-matches'],
    queryFn: () => base44.entities.TournamentMatch.list('-created_date', 100),
    enabled: !!user,
  });

  // Create tournament
  const createMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.Tournament.create({
        tournament_name: form.name || `Tournament ${Date.now()}`,
        total_prize_pool: parseFloat(form.prizePool),
        max_participants: parseInt(form.maxPlayers),
        entry_fee: parseFloat(form.entryFee),
        game_type: form.gameType,
        status: 'registration',
        prize_on_site_only: true, // prizes MUST be spent on-site
        created_by: user.id,
        registration_starts: new Date().toISOString(),
        registration_ends: new Date(Date.now() + 24 * 3600000).toISOString(),
        tournament_starts: new Date(Date.now() + 25 * 3600000).toISOString(),
        tournament_ends: new Date(Date.now() + 48 * 3600000).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-tournaments'] });
      toast.success('Tournament created! Registration is now open.');
      setCreating(false);
      setForm({ name: '', prizePool: '100', maxPlayers: '16', entryFee: '5', gameType: 'survey_speed' });
    },
    onError: e => toast.error(e.message),
  });

  // Run AI matchmaker
  const runMatchmaker = async (tournamentId) => {
    setMatchmaking(true);
    try {
      const res = await base44.functions.invoke('tournamentMatchmaker', { tournament_id: tournamentId });
      queryClient.invalidateQueries({ queryKey: ['dev-tourney-matches'] });
      queryClient.invalidateQueries({ queryKey: ['dev-tournaments'] });
      toast.success(`Brackets generated: ${res.data?.matches_created || 0} matches created`);
    } catch (e) {
      toast.error('Matchmaking failed: ' + e.message);
    } finally {
      setMatchmaking(false);
    }
  };

  // Distribute prizes
  const distributePrizes = async (tournamentId) => {
    setDistributing(tournamentId);
    try {
      const res = await base44.functions.invoke('distributeTournamentPrizes', { tournament_id: tournamentId, on_site_credits_only: true });
      queryClient.invalidateQueries({ queryKey: ['dev-tournaments'] });
      toast.success(`Prizes distributed as on-site credits to ${res.data?.winners_paid || 0} winners!`);
    } catch (e) {
      toast.error('Prize distribution failed: ' + e.message);
    } finally {
      setDistributing(null);
    }
  };

  const activeTourneys = tournaments.filter(t => t.status === 'active' || t.status === 'in_progress');
  const regTourneys = tournaments.filter(t => t.status === 'registration');
  const completedTourneys = tournaments.filter(t => t.status === 'completed');

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-yellow-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-500" /> Gamer Tournament Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Host live contests with AI matchmaking, live brackets & instant prize payouts</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2 py-1">
              <Shield className="w-3 h-3 mr-1 inline" />Prizes: On-site credits only
            </Badge>
            <Button onClick={() => setCreating(!creating)} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white gap-2" size="sm">
              <Plus className="w-4 h-4" /> New Tournament
            </Button>
          </div>
        </div>

        {/* Create form */}
        {creating && (
          <Card className="border-2 border-yellow-200 shadow-lg">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-yellow-600" />Create Tournament</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Tournament Name</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Showdown" className="h-8 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Prize Pool ($)</label>
                  <Input type="number" value={form.prizePool} onChange={e => setForm(f => ({ ...f, prizePool: e.target.value }))} className="h-8 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Max Players</label>
                  <Input type="number" value={form.maxPlayers} onChange={e => setForm(f => ({ ...f, maxPlayers: e.target.value }))} className="h-8 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Entry Fee ($)</label>
                  <Input type="number" value={form.entryFee} onChange={e => setForm(f => ({ ...f, entryFee: e.target.value }))} className="h-8 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Game Type</label>
                  <select value={form.gameType} onChange={e => setForm(f => ({ ...f, gameType: e.target.value }))} className="w-full h-8 text-sm border border-gray-200 rounded-md px-2">
                    <option value="survey_speed">Survey Speed</option>
                    <option value="earnings_race">Earnings Race</option>
                    <option value="referral_battle">Referral Battle</option>
                    <option value="quiz_showdown">Quiz Showdown</option>
                  </select></div>
              </div>
              {/* Prize split preview */}
              <div className="p-3 bg-yellow-50 rounded-xl text-xs">
                <p className="font-semibold text-yellow-800 mb-2">Prize Distribution (on-site credits only — cannot be withdrawn)</p>
                <div className="flex gap-4">
                  {PRIZE_TIERS.map(t => (
                    <div key={t.place} className="text-center">
                      <span className="text-lg">{t.icon}</span>
                      <p className={`font-bold ${t.color}`}>{t.place}</p>
                      <p className="text-gray-600">${((parseFloat(form.prizePool) || 0) * t.pct / 100).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} Create Tournament
                </Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active', value: activeTourneys.length, icon: Play, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Open Registration', value: regTourneys.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Prize Pool', value: `$${tournaments.reduce((s, t) => s + (t.total_prize_pool || 0), 0).toFixed(0)}`, icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Completed', value: completedTourneys.length, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(kpi => (
            <Card key={kpi.label} className="border-0 shadow-md">
              <CardContent className={`p-4 flex items-center gap-3 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="active"><Play className="w-3.5 h-3.5 mr-1" />Active ({activeTourneys.length})</TabsTrigger>
            <TabsTrigger value="registration"><Users className="w-3.5 h-3.5 mr-1" />Registration ({regTourneys.length})</TabsTrigger>
            <TabsTrigger value="brackets"><Swords className="w-3.5 h-3.5 mr-1" />Brackets</TabsTrigger>
            <TabsTrigger value="completed"><CheckCircle className="w-3.5 h-3.5 mr-1" />Completed</TabsTrigger>
          </TabsList>

          {[
            { value: 'active', list: activeTourneys },
            { value: 'registration', list: regTourneys },
            { value: 'completed', list: completedTourneys },
          ].map(({ value, list }) => (
            <TabsContent key={value} value={value} className="mt-4 space-y-3">
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-yellow-500" /></div>
                : list.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No tournaments in this state</div>
                : list.map(t => (
                  <TournamentRow
                    key={t.id}
                    tournament={t}
                    participants={participants.filter(p => p.tournament_id === t.id)}
                    onMatchmake={() => runMatchmaker(t.id)}
                    onDistribute={() => distributePrizes(t.id)}
                    matchmaking={matchmaking}
                    distributing={distributing === t.id}
                  />
                ))
              }
            </TabsContent>
          ))}

          <TabsContent value="brackets" className="mt-4 space-y-3">
            {matches.length === 0 ? (
              <div className="text-center py-16">
                <Swords className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No brackets generated yet — run AI matchmaking on an active tournament</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {matches.slice(0, 20).map((m, i) => (
                  <Card key={m.id || i} className="border-0 shadow-sm">
                    <CardContent className="p-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 text-center">
                        <p className="font-semibold text-gray-700 truncate">{m.player1_id?.slice(0, 8)}…</p>
                      </div>
                      <div className="text-xs font-bold text-gray-400 flex-shrink-0">VS</div>
                      <div className="flex-1 text-center">
                        <p className="font-semibold text-gray-700 truncate">{m.player2_id?.slice(0, 8)}…</p>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${m.status === 'completed' ? 'bg-green-100 text-green-700' : m.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.status || 'pending'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TournamentRow({ tournament: t, participants, onMatchmake, onDistribute, matchmaking, distributing }) {
  const filled = participants.length;
  const pct = t.max_participants > 0 ? Math.round((filled / t.max_participants) * 100) : 0;
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{t.tournament_name || 'Unnamed Tournament'}</h3>
              <Badge className={`text-xs ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'registration' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{t.status}</Badge>
              {t.prize_on_site_only && <Badge className="text-xs bg-amber-100 text-amber-700">🔒 Credits Only</Badge>}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{filled}/{t.max_participants || '?'} players</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Pool: ${t.total_prize_pool || 0}</span>
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />Entry: ${t.entry_fee || 0}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t.game_type || 'survey_speed'}</span>
            </div>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {(t.status === 'registration' || t.status === 'active') && (
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={onMatchmake} disabled={matchmaking}>
                {matchmaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                AI Matchmake
              </Button>
            )}
            {t.status === 'active' && (
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-green-200 text-green-700 hover:bg-green-50"
                onClick={onDistribute} disabled={distributing}>
                {distributing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                Pay Winners
              </Button>
            )}
          </div>
        </div>
        {/* Prize split */}
        <div className="mt-3 flex gap-3 text-xs">
          {PRIZE_TIERS.map(tier => (
            <div key={tier.place} className="flex items-center gap-1">
              <span>{tier.icon}</span>
              <span className={`font-bold ${tier.color}`}>${((t.total_prize_pool || 0) * tier.pct / 100).toFixed(2)}</span>
              <span className="text-gray-400">credits</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}