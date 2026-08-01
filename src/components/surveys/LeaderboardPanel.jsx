import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Loader2, Users, Globe, Flame, ClipboardCheck, PiggyBank, Share2, Star } from 'lucide-react';

/**
 * LeaderboardPanel — friendly competition, in two scopes (your buddies+group, or global). Status fuel is
 * earning / consistency / smart-shopping, not spending. Financial ranks (top earner, top saver) show RANK
 * ONLY — no dollar amounts — so it drives Instagram-style status without exposing money or nudging overspend.
 */
const METRICS = [
  { key: 'earner', label: 'Top earner', icon: Trophy },
  { key: 'streak', label: 'Active days', icon: Flame },
  { key: 'surveys', label: 'Surveys', icon: ClipboardCheck },
  { key: 'saver', label: 'Top saver', icon: PiggyBank },
  { key: 'referrals', label: 'Network', icon: Share2 },
  { key: 'level', label: 'Level', icon: Star },
];
const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);

export default function LeaderboardPanel() {
  const [metric, setMetric] = useState('earner');
  const [scope, setScope] = useState('friends');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('leaderboard', { metric, scope, limit: 10 });
      setData(res.data || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [metric, scope]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="border-2 border-amber-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /><h3 className="font-bold">Leaderboards</h3></div>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button onClick={() => setScope('friends')} className={`px-2 py-1 flex items-center gap-1 ${scope === 'friends' ? 'bg-amber-500 text-white' : 'text-slate-500'}`}><Users className="w-3 h-3" /> Friends</button>
            <button onClick={() => setScope('global')} className={`px-2 py-1 flex items-center gap-1 ${scope === 'global' ? 'bg-amber-500 text-white' : 'text-slate-500'}`}><Globe className="w-3 h-3" /> Global</button>
          </div>
        </div>

        {/* Metric tabs */}
        <div className="flex flex-wrap gap-1 mb-3">
          {METRICS.map((m) => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${metric === m.key ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-slate-200 text-slate-500'}`}>
              <m.icon className="w-3 h-3" /> {m.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : !data || !(data.entries || []).length ? (
          <div className="py-4 text-sm text-slate-400">{scope === 'friends' ? 'Add buddies or join a group to compete with people you know.' : 'No rankings yet — be the first!'}</div>
        ) : (
          <>
            <div className="space-y-1">
              {data.entries.map((e) => (
                <div key={e.rank + e.display_name} className={`flex items-center justify-between text-sm px-2 py-1.5 rounded ${e.is_me ? 'bg-amber-50 font-semibold' : ''}`}>
                  <span className="flex items-center gap-2"><span className="w-7 text-center">{medal(e.rank)}</span>{e.display_name}</span>
                  {data.financial ? <span className="text-[10px] text-slate-400 uppercase tracking-wide">ranked</span>
                    : <span className="text-slate-500">{e.value?.toLocaleString()} {e.unit}</span>}
                </div>
              ))}
            </div>
            {data.my_rank && (
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t">
                Your rank: <b className="text-amber-700">{medal(data.my_rank)}</b>
                {!data.financial && data.my_value != null ? ` · ${data.my_value.toLocaleString()} ${METRICS.find((m) => m.key === metric)?.label.toLowerCase() || ''}` : ''}
                {data.total_ranked ? ` of ${data.total_ranked}` : ''}
              </div>
            )}
            {data.financial && <div className="text-[10px] text-slate-400 mt-2">Money ranks show position only — never amounts.</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
