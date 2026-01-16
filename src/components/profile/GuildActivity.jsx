import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, TrendingUp, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GuildActivity({ userId }) {
  const { data: guilds = [] } = useQuery({
    queryKey: ['userGuilds', userId],
    queryFn: () => base44.entities.Guild.list().then(guilds => 
      guilds.filter(g => g.leader_id === userId || g.member_ids?.includes(userId))
    )
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: ['recentGuildMessages', userId],
    queryFn: async () => {
      if (guilds.length === 0) return [];
      const messages = await base44.entities.ChatMessage.filter({
        guild_id: { $in: guilds.map(g => g.id) }
      }, '-created_date', 5);
      return messages;
    },
    enabled: guilds.length > 0
  });

  if (guilds.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Not in any guilds</p>
          <Link to={createPageUrl('Guilds')}>
            <button className="mt-2 text-blue-600 hover:underline text-sm">
              Join a Guild →
            </button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Guild Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Guilds List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Member of {guilds.length} guild(s)</h4>
          {guilds.map(guild => (
            <div key={guild.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {guild.leader_id === userId && <Crown className="w-4 h-4 text-yellow-500" />}
                <div>
                  <p className="font-semibold text-sm">{guild.guild_name}</p>
                  <p className="text-xs text-gray-600">
                    {guild.member_ids?.length || 0} members • Level {guild.guild_level}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-600">
                ${(guild.total_earnings || 0).toFixed(2)}
              </Badge>
            </div>
          ))}
        </div>

        {/* Recent Messages */}
        {recentMessages.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Recent Guild Chat
            </h4>
            <div className="space-y-2">
              {recentMessages.slice(0, 3).map(msg => (
                <div key={msg.id} className="text-sm">
                  <span className="font-semibold text-gray-700">{msg.user_name}: </span>
                  <span className="text-gray-600">{msg.message.slice(0, 50)}{msg.message.length > 50 ? '...' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={createPageUrl('Guilds')}>
          <button className="w-full mt-2 text-blue-600 hover:underline text-sm text-center">
            View All Guilds →
          </button>
        </Link>
      </CardContent>
    </Card>
  );
}