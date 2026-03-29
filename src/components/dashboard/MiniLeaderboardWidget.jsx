import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Medal, Trophy, Flame, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

function getRankIcon(i) {
  if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
  if (i === 1) return <Medal className="w-4 h-4 text-slate-400" />;
  if (i === 2) return <Medal className="w-4 h-4 text-amber-500" />;
  return <span className="text-gray-400 font-bold text-xs w-4 text-center">#{i + 1}</span>;
}

export default function MiniLeaderboardWidget({ user }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayEarnings = [] } = useQuery({
    queryKey: ['mini-lb-today', today],
    queryFn: () => base44.entities.DailyEarnings.filter({ date: today }),
    refetchInterval: 60000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['mini-lb-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => Object.fromEntries(allUsers.map(u => [u.id, u])), [allUsers]);

  const ranked = useMemo(() =>
    todayEarnings
      .map(e => ({ user_id: e.user_id, name: userMap[e.user_id]?.full_name || 'Anonymous', earned: e.total_earned || 0 }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5),
    [todayEarnings, userMap]
  );

  const myRank = ranked.findIndex(e => e.user_id === user?.id);

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Trophy className="w-4 h-4" />
          <span className="font-bold text-sm">Today's Leaderboard</span>
          <div className="flex items-center gap-1 text-yellow-100 text-xs">
            <Flame className="w-3 h-3" /> Live
          </div>
        </div>
        <Link to={createPageUrl('GlobalLeaderboard')}>
          <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 h-6 text-xs gap-1">
            Full Board <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      <CardContent className="p-3 space-y-2">
        {ranked.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">No activity today yet — be first!</p>
        ) : (
          ranked.map((entry, i) => {
            const isMe = entry.user_id === user?.id;
            return (
              <div key={entry.user_id || i} className={`flex items-center gap-2 p-2 rounded-lg ${
                i === 0 ? 'bg-yellow-50 border border-yellow-200' :
                isMe ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
              }`}>
                <div className="w-5 flex items-center justify-center flex-shrink-0">{getRankIcon(i)}</div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(entry.name || 'U').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate flex items-center gap-1">
                    {entry.name}
                    {isMe && <Badge className="bg-indigo-600 text-[10px] py-0 px-1 h-4">You</Badge>}
                  </p>
                </div>
                <p className="text-sm font-black text-green-600 flex-shrink-0">${(entry.earned || 0).toFixed(2)}</p>
              </div>
            );
          })
        )}

        {myRank < 0 && user && (
          <div className="text-center pt-1 pb-0.5">
            <p className="text-xs text-gray-400">Not ranked yet today — complete a survey to join!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}