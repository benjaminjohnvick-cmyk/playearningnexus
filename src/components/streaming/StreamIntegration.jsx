import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Twitch, Youtube, Users, Eye, DollarSign, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function StreamIntegration({ user }) {
  const [streamData, setStreamData] = useState({
    platform: 'twitch',
    channel_url: '',
    is_live: false
  });
  const queryClient = useQueryClient();

  const { data: activeStreams = [] } = useQuery({
    queryKey: ['active-streams'],
    queryFn: async () => {
      return await base44.entities.StreamSession.filter({
        is_active: true
      }, '-created_date', 20);
    }
  });

  const { data: myStream } = useQuery({
    queryKey: ['my-stream', user?.id],
    queryFn: async () => {
      const streams = await base44.entities.StreamSession.filter({
        streamer_user_id: user.id,
        is_active: true
      });
      return streams[0] || null;
    },
    enabled: !!user
  });

  const startStreamMutation = useMutation({
    mutationFn: async (data) => {
      // Award points for streaming
      await base44.entities.UserActivity.create({
        user_id: user.id,
        activity_type: 'stream_started',
        points_earned: 100,
        description: 'Started streaming'
      });

      await base44.auth.updateMe({
        gamification_points: (user.gamification_points || 0) + 100
      });

      return await base44.entities.StreamSession.create({
        streamer_user_id: user.id,
        streamer_name: user.full_name,
        platform: data.platform,
        stream_url: data.channel_url,
        is_active: true,
        current_viewers: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-stream']);
      queryClient.invalidateQueries(['active-streams']);
      toast.success('Stream started! +100 points');
    }
  });

  const endStreamMutation = useMutation({
    mutationFn: async (streamId) => {
      const stream = await base44.entities.StreamSession.filter({ id: streamId });
      if (stream.length === 0) return;

      const duration = Math.floor((new Date() - new Date(stream[0].created_date)) / 60000);
      const bonusPoints = Math.min(duration * 5, 500);

      await base44.entities.StreamSession.update(streamId, {
        is_active: false,
        ended_at: new Date().toISOString()
      });

      if (bonusPoints > 0) {
        await base44.auth.updateMe({
          gamification_points: (user.gamification_points || 0) + bonusPoints
        });

        await base44.entities.UserActivity.create({
          user_id: user.id,
          activity_type: 'stream_ended',
          points_earned: bonusPoints,
          description: `Streamed for ${duration} minutes`
        });
      }

      return bonusPoints;
    },
    onSuccess: (bonusPoints) => {
      queryClient.invalidateQueries(['my-stream']);
      queryClient.invalidateQueries(['active-streams']);
      toast.success(`Stream ended! +${bonusPoints} bonus points`);
    }
  });

  const extractEmbedUrl = (url, platform) => {
    if (platform === 'twitch') {
      const channelMatch = url.match(/twitch\.tv\/([^\/]+)/);
      return channelMatch ? `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${window.location.hostname}` : null;
    } else if (platform === 'youtube') {
      const videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      return videoMatch ? `https://www.youtube.com/embed/${videoMatch[1]}?autoplay=1` : null;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Stream Controls */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Video className="w-6 h-6" />
            Stream Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {myStream ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 border-2 border-red-500 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <div>
                    <p className="font-bold text-red-700">LIVE</p>
                    <p className="text-sm text-gray-600">Streaming on {myStream.platform}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => endStreamMutation.mutate(myStream.id)}
                >
                  End Stream
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <Eye className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{myStream.current_viewers || 0}</p>
                  <p className="text-sm text-gray-600">Viewers</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{myStream.tips_earned || 0}</p>
                  <p className="text-sm text-gray-600">Tips Earned</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Tabs value={streamData.platform} onValueChange={(v) => setStreamData({...streamData, platform: v})}>
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="twitch">
                    <Twitch className="w-4 h-4 mr-2" />
                    Twitch
                  </TabsTrigger>
                  <TabsTrigger value="youtube">
                    <Youtube className="w-4 h-4 mr-2" />
                    YouTube
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Input
                placeholder={`Enter your ${streamData.platform} stream URL...`}
                value={streamData.channel_url}
                onChange={(e) => setStreamData({...streamData, channel_url: e.target.value})}
              />

              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                onClick={() => startStreamMutation.mutate(streamData)}
                disabled={!streamData.channel_url}
              >
                <Video className="w-4 h-4 mr-2" />
                Start Streaming (+100 Points)
              </Button>

              <p className="text-xs text-gray-600 text-center">
                Earn points for streaming! 100 pts to start + 5 pts/minute (max 500)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Streams */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Now ({activeStreams.length})</span>
            <Badge className="bg-red-500">LIVE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeStreams.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No live streams</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activeStreams.map((stream) => {
                const embedUrl = extractEmbedUrl(stream.stream_url, stream.platform);
                
                return (
                  <div key={stream.id} className="border rounded-lg overflow-hidden">
                    {embedUrl && (
                      <iframe
                        src={embedUrl}
                        className="w-full h-48"
                        allowFullScreen
                      />
                    )}
                    <div className="p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{stream.streamer_name}</p>
                        <Badge className="text-xs capitalize">{stream.platform}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {stream.current_viewers || 0}
                        </span>
                        <a 
                          href={stream.stream_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <LinkIcon className="w-3 h-3" />
                          Watch
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}