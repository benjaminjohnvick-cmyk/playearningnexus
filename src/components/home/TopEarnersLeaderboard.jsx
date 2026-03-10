import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Crown } from 'lucide-react';

const rankStyles = [
  { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Crown className="w-4 h-4 text-yellow-500" /> },
  { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <Medal className="w-4 h-4 text-gray-400" /> },
  { bg: 'bg-orange-100', text: 'text-orange-600',  icon: <Medal className="w-4 h-4 text-orange-400" /> },
];

export default function TopEarnersLeaderboard() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['top-earners'],
    queryFn: () => base44.entities.User.list('-total_earnings', 10),
    staleTime: 60_000,
  });

  const top = users.filter(u => (u.total_earnings || 0) > 0).slice(0, 10);

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h3 className="font-bold text-lg text-gray-900">Top Earners</h3>
        <span className="ml-auto text-xs text-gray-400">All-time</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No earners yet — be the first!</p>
      ) : (
        <ol className="space-y-2">
          {top.map((u, i) => {
            const style = rankStyles[i] || { bg: 'bg-gray-50', text: 'text-gray-500', icon: null };
            return (
              <li key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${style.bg}`}>
                <span className={`w-5 text-center font-bold text-sm ${style.text}`}>
                  {style.icon || `#${i + 1}`}
                </span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(u.full_name || 'U')[0].toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {u.full_name || 'Anonymous'}
                </span>
                <span className="text-sm font-bold text-green-600">
                  ${(u.total_earnings || 0).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}