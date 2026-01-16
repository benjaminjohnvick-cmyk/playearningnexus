import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Users, Sparkles, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StreamDiscovery() {
  const [user, setUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: liveStreams = [] } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: () => base44.entities.StreamSession.filter({ is_live: true }, '-start_time'),
    refetchInterval: 10000
  });

  const { data: recommendedStreams = [] } = useQuery({
    queryKey: ['recommendedStreams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get user's favorite games and viewing history
      const viewHistory = await base44.entities.GameEngagement.filter(
        { user_id: user.id, session_type: 'spectating' },
        '-session_start',
        20
      );
      
      const favoriteGameIds = user.favorite_games || [];
      const viewedGameIds = [...new Set(viewHistory.map(v => v.game_id))];
      
      // Use AI to recommend streams
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on user preferences:
- Favorite games: ${favoriteGameIds.join(', ')}
- Recently viewed games: ${viewedGameIds.join(', ')}
- User interests: gaming, streaming

Recommend 5 stream IDs from this list that would be most relevant: ${liveStreams.map(s => s.id).join(', ')}
Return as JSON array of stream IDs.`,
        response_json_schema: {
          type: "object",
          properties: {
            stream_ids: { type: "array", items: { type: "string" } }
          }
        }
      });

      return liveStreams.filter(s => response.stream_ids?.includes(s.id));
    },
    enabled: !!user && liveStreams.length > 0
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list()
  });

  const categories = [...new Set(liveStreams.map(s => s.category).filter(Boolean))];

  const filteredStreams = selectedCategory === 'all' 
    ? liveStreams 
    : liveStreams.filter(s => s.category === selectedCategory);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="recommended">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommended">
            <Sparkles className="w-4 h-4 mr-2" />
            For You
          </TabsTrigger>
          <TabsTrigger value="live">
            <Eye className="w-4 h-4 mr-2" />
            Live Now
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Filter className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Recommended for You
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendedStreams.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {recommendedStreams.map(stream => (
                    <StreamCard key={stream.id} stream={stream} games={games} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No personalized recommendations yet. Watch some streams to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-red-600" />
                Live Now ({liveStreams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStreams.map(stream => (
                  <StreamCard key={stream.id} stream={stream} games={games} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                size="sm"
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStreams.map(stream => (
              <StreamCard key={stream.id} stream={stream} games={games} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StreamCard({ stream, games }) {
  const game = games.find(g => g.id === stream.game_id);
  const [streamer, setStreamer] = useState(null);

  useEffect(() => {
    const fetchStreamer = async () => {
      const users = await base44.entities.User.filter({ id: stream.streamer_id });
      setStreamer(users[0]);
    };
    fetchStreamer();
  }, [stream.streamer_id]);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <img 
            src={game?.icon_url} 
            alt={game?.title}
            className="w-16 h-16 rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{stream.title}</h3>
            <p className="text-sm text-gray-600">{streamer?.full_name || 'Loading...'}</p>
            <Badge className="bg-red-600 mt-1">LIVE</Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{game?.title}</span>
          <div className="flex items-center gap-1 text-purple-600">
            <Users className="w-4 h-4" />
            <span>{stream.peak_viewers || 0}</span>
          </div>
        </div>

        <Link to={createPageUrl('UserProfile') + `?user_id=${stream.streamer_id}`}>
          <Button size="sm" className="w-full mt-3">
            Watch Stream
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}