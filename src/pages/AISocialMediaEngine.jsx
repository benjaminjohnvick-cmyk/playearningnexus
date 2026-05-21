import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, TrendingUp, Share2, RefreshCw, CheckCircle, Clock, Play, Hash } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_CONFIG = {
  tiktok:    { label: 'TikTok',     emoji: '🎵', color: 'from-gray-900 to-black',         textColor: 'text-white',  maxLen: 150 },
  instagram: { label: 'Instagram',  emoji: '📸', color: 'from-pink-500 to-purple-600',     textColor: 'text-white',  maxLen: 200 },
  twitter:   { label: 'X/Twitter',  emoji: '🐦', color: 'from-gray-700 to-gray-900',       textColor: 'text-white',  maxLen: 280 },
  facebook:  { label: 'Facebook',   emoji: '👤', color: 'from-blue-600 to-blue-800',       textColor: 'text-white',  maxLen: 400 },
  snapchat:  { label: 'Snapchat',   emoji: '👻', color: 'from-yellow-400 to-yellow-500',   textColor: 'text-gray-900', maxLen: 200 },
};

export default function AISocialMediaEngine() {
  const [user, setUser] = useState(null);
  const [scripts, setScripts] = useState({});
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: connections = [] } = useQuery({
    queryKey: ['socialConnections', user?.id],
    queryFn: () => base44.entities.SocialMediaConnection.filter({ user_id: user.id, is_active: true }),
    enabled: !!user?.id,
  });

  const { data: topPosts = [] } = useQuery({
    queryKey: ['topAffiliatePosts'],
    queryFn: () => base44.entities.ContentLibraryTemplate.filter({ status: 'active' }, '-performance_metrics.performance_score', 10),
    enabled: !!user?.id,
  });

  const connectedPlatforms = connections.map(c => c.platform).filter(p => PLATFORM_CONFIG[p]);

  const TRENDING_HASHTAGS = {
    tiktok:    ['#GamerGain', '#EarnMoney', '#SideHustle', '#MakeMoneyOnline', '#GamingLife', '#FYP', '#viral'],
    instagram: ['#GamerGain', '#EarnFromHome', '#SideIncome', '#GamingCommunity', '#MoneyTips', '#Reels'],
    twitter:   ['#GamerGain', '#EarnOnline', '#Passive Income', '#Gaming', '#Crypto'],
    facebook:  ['#GamerGain', '#EarnMoney', '#WorkFromHome', '#Gaming'],
    snapchat:  ['#GamerGain', '#EarnOnline', '#Games', '#Money'],
  };

  const generateScripts = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      // Pick top post as inspiration
      const inspiration = topPosts[0]?.base_content || 'Join GamerGain to earn money by completing surveys, playing games, and referring friends. Daily payouts available!';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a viral social media content expert. Based on this top-performing affiliate content: "${inspiration}"

Create SHORT viral scripts optimized for each platform. For each, include:
- A punchy hook (first line)
- Core value prop (1-2 lines)  
- A strong CTA

Format EXACTLY as JSON:
{
  "tiktok": "script text here (max 150 chars, TikTok voice-over style)",
  "instagram": "script text here (max 200 chars, Reels caption style)",
  "twitter": "script text here (max 280 chars, tweet style)",
  "facebook": "script text here (max 400 chars, engaging post style)",
  "snapchat": "script text here (max 200 chars, casual snap style)"
}

Make each one feel native to its platform. Mention GamerGain, earning money, and a sense of urgency.`,
        response_json_schema: {
          type: 'object',
          properties: {
            tiktok: { type: 'string' },
            instagram: { type: 'string' },
            twitter: { type: 'string' },
            facebook: { type: 'string' },
            snapchat: { type: 'string' },
          },
        },
      });
      setScripts(result);
      toast.success('✅ AI scripts generated for all platforms!');
    } catch (e) {
      toast.error('Script generation failed');
    }
    setGenerating(false);
  };

  const handlePublish = async (platform) => {
    if (!scripts[platform]) return;
    setPublishing(platform);
    try {
      await base44.entities.SocialMediaPost.create({
        user_id: user.id,
        platform,
        content: scripts[platform],
        hashtags: TRENDING_HASHTAGS[platform] || [],
        status: 'scheduled',
        scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
        is_ai_generated: true,
        source: 'ai_social_engine',
      });

      setScheduledPosts(prev => [...prev, platform]);
      toast.success(`🚀 Scheduled for ${PLATFORM_CONFIG[platform]?.label}!`);
    } catch (e) {
      toast.error('Scheduling failed. Try again.');
    }
    setPublishing(null);
  };

  const handlePublishAll = async () => {
    if (!connectedPlatforms.length) { toast.error('No connected platforms'); return; }
    for (const platform of connectedPlatforms) {
      if (scripts[platform] && !scheduledPosts.includes(platform)) {
        await handlePublish(platform);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-purple-700 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black mb-1">🤖 AI Social Media Engine</h1>
              <p className="text-pink-200">Turn top affiliate content into viral scripts — then publish with one click</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {connectedPlatforms.map(p => (
                <Badge key={p} className="bg-white/20 text-white border-0">
                  {PLATFORM_CONFIG[p]?.emoji} {PLATFORM_CONFIG[p]?.label}
                </Badge>
              ))}
              {connectedPlatforms.length === 0 && (
                <Badge className="bg-white/20 text-white border-0">No platforms connected</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex gap-3 mb-8 flex-wrap items-center">
          <Button
            onClick={generateScripts}
            disabled={generating}
            className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold h-12 px-6"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            {generating ? 'AI Generating Scripts...' : '⚡ Generate Viral Scripts (AI)'}
          </Button>

          {Object.keys(scripts).length > 0 && (
            <Button
              onClick={handlePublishAll}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold h-12 px-6"
            >
              <Share2 className="w-4 h-4 mr-2" />
              One-Click Publish All ({connectedPlatforms.filter(p => !scheduledPosts.includes(p)).length} remaining)
            </Button>
          )}
        </div>

        {/* Top Performing Inspiration */}
        {topPosts.length > 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-600" />
                AI Source: Top-Performing Affiliate Content
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {topPosts.slice(0, 3).map((post, i) => (
                  <div key={i}
                    onClick={() => setSelectedTemplate(post)}
                    className={`flex-shrink-0 w-64 bg-white rounded-xl border-2 p-3 cursor-pointer transition-all ${selectedTemplate?.id === post.id ? 'border-yellow-500 shadow-md' : 'border-yellow-200 hover:border-yellow-400'}`}>
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs mb-2">{post.content_type || 'top post'}</Badge>
                    <p className="text-xs text-gray-700 line-clamp-3">{post.base_content}</p>
                    <p className="text-xs text-gray-400 mt-2">Score: {post.performance_metrics?.performance_score || '—'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Platform Scripts */}
        {Object.keys(scripts).length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">Click "Generate Viral Scripts" to get started</p>
            <p className="text-sm">AI will analyze top affiliate content and create platform-optimized scripts</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {Object.entries(scripts).map(([platform, script]) => {
              const cfg = PLATFORM_CONFIG[platform];
              if (!cfg) return null;
              const isConnected = connectedPlatforms.includes(platform);
              const isScheduled = scheduledPosts.includes(platform);
              const hashtags = TRENDING_HASHTAGS[platform] || [];
              return (
                <Card key={platform} className={`border-2 overflow-hidden ${isScheduled ? 'border-green-400' : 'border-gray-200'}`}>
                  <div className={`h-2 bg-gradient-to-r ${cfg.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cfg.emoji}</span>
                        <span className="font-black text-gray-900">{cfg.label}</span>
                        {!isConnected && <Badge className="bg-gray-100 text-gray-500 text-xs">Not connected</Badge>}
                      </div>
                      {isScheduled && <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Scheduled</Badge>}
                    </div>

                    {/* Script */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm text-gray-800 leading-relaxed border min-h-[80px]">
                      {script}
                    </div>

                    {/* Hashtags */}
                    <div className="flex gap-1 flex-wrap mb-4">
                      {hashtags.map((h, i) => (
                        <span key={i} className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">{h}</span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className={`flex-1 bg-gradient-to-r ${cfg.color} text-white font-bold border-0`}
                        disabled={!isConnected || isScheduled || publishing === platform}
                        onClick={() => handlePublish(platform)}
                      >
                        {publishing === platform ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> :
                         isScheduled ? <Clock className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                        {isScheduled ? 'Scheduled' : publishing === platform ? 'Scheduling...' : '1-Click Publish'}
                      </Button>
                    </div>
                    {!isConnected && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Connect this platform in Social Media Setup to publish</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Scheduled posts summary */}
        {scheduledPosts.length > 0 && (
          <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-xl p-5">
            <h3 className="font-black text-green-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Posts Scheduled — Going live in ~5 minutes
            </h3>
            <div className="flex gap-2 flex-wrap">
              {scheduledPosts.map(p => (
                <Badge key={p} className="bg-green-600 text-white">
                  {PLATFORM_CONFIG[p]?.emoji} {PLATFORM_CONFIG[p]?.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-green-700 mt-2">AI-generated scripts with trending hashtags are queued for automatic publishing.</p>
          </div>
        )}
      </div>
    </div>
  );
}