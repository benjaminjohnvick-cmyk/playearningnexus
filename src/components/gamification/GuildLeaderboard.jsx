import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, TrendingUp, Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GuildLeaderboard({ currentGuildId }) {
  const { data: guilds = [] } = useQuery({
    queryKey: ['guildLeaderboard'],
    queryFn: () => base44.entities.Guild.list('-total_earnings', 50)
  });

  const topGuilds = guilds.slice(0, 10);
  const currentGuild = guilds.find(g => g.id === currentGuildId);

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-purple-600" />
          <div>
            <CardTitle className="text-2xl">Guild Leaderboard</CardTitle>
            <p className="text-sm text-gray-600">Top earning guilds this season</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {currentGuild && currentGuild.rank > 10 && (
          <Card className="p-4 mb-4 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-blue-600">#{currentGuild.rank || guilds.indexOf(currentGuild) + 1}</div>
                <div>
                  <p className="font-bold text-gray-900">Your Guild</p>
                  <p className="text-sm text-gray-600">{currentGuild.guild_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">${(currentGuild.total_earnings || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-500">{currentGuild.member_ids?.length || 0} members</p>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {topGuilds.map((guild, index) => {
            const rank = index + 1;
            const isCurrentGuild = guild.id === currentGuildId;
            
            return (
              <motion.div
                key={guild.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`p-4 ${
                  isCurrentGuild ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-400' :
                  rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300' :
                  rank === 2 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300' :
                  rank === 3 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300' :
                  'bg-white border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getRankIcon(rank)}
                      <div>
                        <p className="font-bold text-lg">{guild.guild_name}</p>
                        <div className="flex gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {guild.member_ids?.length || 0}
                          </span>
                          <span>•</span>
                          <span>Level {guild.guild_level}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        ${(guild.total_earnings || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Total Earnings</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}