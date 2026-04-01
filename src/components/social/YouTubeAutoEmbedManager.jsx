import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Youtube, Play, BarChart3, DollarSign, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function YouTubeAutoEmbedManager({ user }) {
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [channelId, setChannelId] = useState(null);

  useEffect(() => {
    const checkYoutubeStatus = async () => {
      try {
        // Check if user has YouTube OAuth token stored
        const userProfiles = await base44.asServiceRole.entities.SocialConnection.filter({
          user_id: user.id,
          platform: 'youtube'
        });
        if (userProfiles.length > 0) {
          setYoutubeConnected(true);
          setChannelId(userProfiles[0].channel_id);
          loadVideos(userProfiles[0].channel_id);
        }
      } catch (e) {
        console.error('Error checking YouTube status:', e);
      }
    };
    checkYoutubeStatus();
  }, [user.id]);

  const loadVideos = async (chanId) => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('youtubeAutoEmbed', {
        action: 'getChannelVideos',
        channelId: chanId
      });
      if (response.data.success) {
        setVideos(response.data.videos);
      }
    } catch (e) {
      console.error('Error loading videos:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const url = await base44.connectors.connectAppUser('youtube_connector_id');
      window.open(url, '_blank');
      toast.success('YouTube OAuth window opened. Please authorize and return.');
      
      // Poll for authorization
      const timer = setInterval(async () => {
        const userProfiles = await base44.asServiceRole.entities.SocialConnection.filter({
          user_id: user.id,
          platform: 'youtube'
        });
        if (userProfiles.length > 0) {
          clearInterval(timer);
          setYoutubeConnected(true);
          setChannelId(userProfiles[0].channel_id);
          loadVideos(userProfiles[0].channel_id);
          toast.success('YouTube account connected! AI agent is ready.');
        }
      }, 2000);

      setTimeout(() => clearInterval(timer), 60000); // Stop polling after 1 minute
    } catch (e) {
      toast.error('Failed to connect YouTube: ' + e.message);
    }
  };

  const embedVideo = async (videoId) => {
    try {
      const response = await base44.functions.invoke('youtubeAutoEmbed', {
        action: 'embedVideo',
        videoId,
        channelId,
        videoTitle: videos.find(v => v.video_id === videoId)?.video_title,
        videoUrl: `https://youtube.com/watch?v=${videoId}`
      });
      
      if (response.data.success) {
        toast.success('✅ Ad grid embedded! Appears at intro (0s) and outro');
        loadVideos(channelId);
      }
    } catch (e) {
      toast.error('Failed to embed video: ' + e.message);
    }
  };

  if (!youtubeConnected) {
    return (
      <Card className="border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50 p-6">
        <div className="text-center">
          <Youtube className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Connect Your YouTube Channel</h3>
          <p className="text-gray-600 mb-4">
            Our AI agent will automatically add the GamerGain ad grid to your video intros and outros.
            Earn $0.20 per click!
          </p>
          <Button 
            onClick={handleConnectYouTube}
            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
          >
            <Youtube className="w-5 h-5" />
            Connect YouTube Account
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="text-xl font-bold text-gray-900">YouTube AI Agent Active</h3>
              <p className="text-sm text-gray-600">Auto-embedding ad grid in your videos</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setYoutubeConnected(false)}>
            Change Account
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="videos">
            <Play className="w-4 h-4 mr-2" /> Videos
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
          ) : videos.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No videos found. Upload a video to YouTube to get started!</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {videos.map((video, idx) => (
                <motion.div key={video.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">{video.video_title}</h4>
                        <p className="text-xs text-gray-500 mb-2">Video ID: {video.video_id}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">📊 Views: {video.views_count?.toLocaleString()}</span>
                          <span className="text-green-600 font-bold">💰 ${video.earnings_from_grid?.toFixed(2)}</span>
                          <span className="text-blue-600">🖱️ {video.grid_clicks} clicks</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {video.status === 'embedded' ? (
                          <Badge className="bg-green-600 text-white mb-2">✓ Embedded</Badge>
                        ) : (
                          <Badge className="bg-yellow-600 text-white mb-2">{video.status}</Badge>
                        )}
                        {video.status !== 'embedded' && (
                          <Button 
                            size="sm"
                            onClick={() => embedVideo(video.video_id)}
                            className="bg-red-600 hover:bg-red-700 text-white gap-1"
                          >
                            <Play className="w-3 h-3" /> Embed Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Channel Performance</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 p-4 border-0">
                <p className="text-xs text-gray-600 font-semibold">Videos Embedded</p>
                <p className="text-3xl font-black text-blue-600 mt-2">
                  {videos.filter(v => v.status === 'embedded').length}
                </p>
              </Card>
              <Card className="bg-green-50 p-4 border-0">
                <p className="text-xs text-gray-600 font-semibold">Total Earnings</p>
                <p className="text-3xl font-black text-green-600 mt-2">
                  ${videos.reduce((s, v) => s + (v.earnings_from_grid || 0), 0).toFixed(2)}
                </p>
              </Card>
              <Card className="bg-purple-50 p-4 border-0">
                <p className="text-xs text-gray-600 font-semibold">Total Clicks</p>
                <p className="text-3xl font-black text-purple-600 mt-2">
                  {videos.reduce((s, v) => s + (v.grid_clicks || 0), 0)}
                </p>
              </Card>
              <Card className="bg-orange-50 p-4 border-0">
                <p className="text-xs text-gray-600 font-semibold">Avg CTR</p>
                <p className="text-3xl font-black text-orange-600 mt-2">
                  {videos.length > 0 ? ((videos.reduce((s, v) => s + (v.grid_clicks || 0), 0) / videos.reduce((s, v) => s + (v.views_count || 1), 0)) * 100).toFixed(1) : 0}%
                </p>
              </Card>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}