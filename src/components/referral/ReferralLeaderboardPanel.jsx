import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, TrendingUp } from 'lucide-react';

const RANK_STYLES = [
  { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-white', icon: Crown, label: '1st' },
  { bg: 'bg-gradient-to-r from-slate-300 to-slate-400', text: 'text-white', icon: Medal, label: '2nd' },
  { bg: 'bg-gradient-to-r from-amber-600 to-amber-700', text: 'text-white', icon: Medal, label: '3rd' },
];

export default function ReferralLeaderboardPanel({ leaderboard = [], currentUserId }) {
  if (!leaderboard.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Leaderboard data loading...</p>
        </CardContent>
      </Card>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-4">
      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3">
        {top3.map((entry, i) => {
          const style = RANK_STYLES[i];
          const RankIcon = style.icon;
          const isMe = entry.user_id === currentUserId;
          return (
            <Card key={entry.user_id || i} className={`border-0 shadow-md overflow-hidden ${isMe ? 'ring-2 ring-indigo-400' : ''}`}>
              <div className={`${style.bg} p-3 text-center`}>
                <RankIcon className={`w-6 h-6 ${style.text} mx-auto mb-1`} />
                <p className={`text-xs font-bold ${style.text}`}>{style.label}</p>
              </div>
              <CardContent className="p-3 text-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-indigo-700">{(entry.name || 'U')[0].toUpperCase()}</span>
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">{isMe ? 'You' : (entry.name || 'User')}</p>
                <p className="text-sm font-bold text-green-600 mt-1">${(entry.total_commission || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{entry.active_referrals || 0} referrals</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Full Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rest.map((entry, i) => {
                const isMe = entry.user_id === currentUserId;
                return (
                  <div key={entry.user_id || i}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg ${isMe ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'}`}>
                    <span className="text-sm font-bold text-gray-400 w-6">#{i + 4}</span>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-600">{(entry.name || 'U')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{isMe ? 'You' : (entry.name || 'User')}</p>
                      <p className="text-xs text-gray-400">{entry.active_referrals || 0} referrals</p>
                    </div>
                    <p className="text-sm font-bold text-green-600">${(entry.total_commission || 0).toFixed(2)}</p>
                    {isMe && <Badge className="bg-indigo-100 text-indigo-700 text-xs">You</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}