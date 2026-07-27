import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, History, Loader2 } from 'lucide-react';

// Weekly leaderboard — the separate weekly board (score − period_baseline) reset on the
// LEADERBOARD_RESET_DAYS cadence, plus past periods' winners archived by leaderboardReset. All-time
// scores are shown alongside but are never reset.
export default function WeeklyLeaderboard() {
  const [rows, setRows] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [entries, arch] = await Promise.all([
          base44.entities.LeaderboardEntry.list('-total_earnings', 500).catch(() => []),
          base44.entities.LeaderboardArchive.filter({}, '-period_end', 12).catch(() => []),
        ]);
        const metric = (e) => Number(e.total_earnings) || Number(e.score) || 0;
        const ranked = (entries || [])
          .map((e) => ({
            user_id: e.user_id,
            name: e.user_name || e.name || 'Player',
            weekly: Math.round((metric(e) - (Number(e.period_baseline) || 0)) * 100) / 100,
            all_time: metric(e),
          }))
          .filter((r) => r.weekly > 0)
          .sort((a, b) => b.weekly - a.weekly)
          .slice(0, 50);
        setRows(ranked);
        setArchives(arch || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

  if (loading) return <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading leaderboard…</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><Trophy className="w-6 h-6 text-amber-500" /><h1 className="text-2xl font-bold">Weekly Leaderboard</h1></div>
      <p className="text-sm text-zinc-500 mb-6">This week's top players by points earned this period. Resets on schedule — your all-time score is never lost.</p>

      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">This week</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 && <div className="text-sm text-zinc-400">No points earned yet this period — be the first!</div>}
          <div className="divide-y divide-zinc-100">
            {rows.map((r, i) => (
              <div key={r.user_id || i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center font-semibold ${i < 3 ? 'text-lg' : 'text-sm text-zinc-500'}`}>{medal(i)}</span>
                  <span className="font-medium">{r.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{r.weekly.toLocaleString()} pts</span>
                  <span className="text-xs text-zinc-400">all-time {r.all_time.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 mb-3"><History className="w-5 h-5 text-zinc-500" /><h2 className="text-lg font-semibold">Past champions</h2></div>
      {archives.length === 0 && <div className="text-sm text-zinc-400">No completed periods yet.</div>}
      <div className="space-y-4">
        {archives.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {new Date(a.period_start).toLocaleDateString()} – {new Date(a.period_end).toLocaleDateString()}
              </CardTitle>
              <Badge className="bg-zinc-500 text-white">{a.participants ?? (a.winners || []).length} players</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(a.winners || []).slice(0, 10).map((w) => (
                  <div key={`${a.id}-${w.rank}`} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-6 text-center">{w.rank <= 3 ? <Medal className="w-4 h-4 inline text-amber-500" /> : `#${w.rank}`}</span>
                      {w.user_name || 'Player'}
                    </span>
                    <span className="text-zinc-500">{Number(w.period_score || 0).toLocaleString()} pts</span>
                  </div>
                ))}
                {(a.winners || []).length === 0 && <div className="text-sm text-zinc-400">No winners recorded for this period.</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
