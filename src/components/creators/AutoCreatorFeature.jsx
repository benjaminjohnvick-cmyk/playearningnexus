import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Copy, Share2, RefreshCw, Loader2, TrendingUp, CheckCircle, Film, Camera, Video } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', color: '#ff0050', icon: Film, hint: 'Short, punchy, trending hooks. Use emojis.' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#FF0000', icon: Video, hint: 'Engaging thumbnail-worthy hook, clear CTA.' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: Camera, hint: 'Visually descriptive, hashtag-rich, story-telling.' },
];

export default function AutoCreatorFeature({ user }) {
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState({});
  const [selectedPlatforms, setSelectedPlatforms] = useState(['tiktok', 'youtube_shorts', 'instagram']);
  const [copiedId, setCopiedId] = useState(null);

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['creator-activities', user?.id],
    queryFn: () => base44.entities.UserActivity.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const { data: recentSurveys = [] } = useQuery({
    queryKey: ['creator-surveys', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 7),
    enabled: !!user?.id,
  });

  const referralLink = `${window.location.origin}?ref=${user?.id || 'user'}`;

  const buildContext = () => {
    const surveyTotal = recentSurveys.reduce((s, d) => s + (d.total_earned || 0), 0);
    const gameMilestones = recentActivities.filter(a => a.activity_type === 'game_installed' || a.activity_type === 'achievement_unlocked');
    const highEarningDays = recentSurveys.filter(d => (d.total_earned || 0) >= 3).length;

    return {
      totalEarned: (user?.total_earnings || 0).toFixed(2),
      recentWeekEarned: surveyTotal.toFixed(2),
      highEarningDays,
      gameMilestones: gameMilestones.slice(0, 3).map(a => a.description).join(', ') || 'none yet',
      surveysCompleted: recentSurveys.reduce((s, d) => s + (d.total_surveys_completed || 0), 0),
      referralLink,
      userName: user?.full_name?.split(' ')[0] || 'I',
    };
  };

  const generatePosts = async () => {
    setGenerating(true);
    const ctx = buildContext();
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a viral social media content expert. Create engaging posts for a GamerGain user who earns real money by playing games and completing surveys.

User stats:
- Total earnings: $${ctx.totalEarned}
- This week: $${ctx.recentWeekEarned}
- High-earning days (≥$3): ${ctx.highEarningDays} out of last 7 days
- Surveys completed this week: ${ctx.surveysCompleted}
- Game milestones: ${ctx.gameMilestones}
- Name: ${ctx.userName}
- Referral link: ${ctx.referralLink}

Create one viral post for EACH of these platforms: TikTok, YouTube Shorts, Instagram.

Rules:
- ALWAYS include the referral link naturally at the end
- Make it authentic, first-person, relatable, and exciting
- TikTok: short hook, 3-5 sentences, 5+ emojis, trending energy
- YouTube Shorts: attention-grabbing first line, story arc, clear CTA
- Instagram: storytelling caption, 15-20 hashtags at end, referral link in bio note
- Highlight real earnings, make it feel genuine not spammy
- Mention the contest/jackpot potential ($1M+) where natural

Return JSON with keys: tiktok, youtube_shorts, instagram (each a string).`,
        response_json_schema: {
          type: 'object',
          properties: {
            tiktok: { type: 'string' },
            youtube_shorts: { type: 'string' },
            instagram: { type: 'string' },
          }
        }
      });
      setPosts(result);
      toast.success('🎉 Posts generated! Copy and post to go viral.');
    } catch (e) {
      toast.error('Failed to generate posts. Please try again.');
    }
    setGenerating(false);
  };

  const copyPost = (platformId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(platformId);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-600 border-0 text-white shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-black">Auto-Creator</h2>
              <p className="text-pink-100 text-sm">AI turns your earnings into viral posts with your referral link</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-4">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">${(user?.total_earnings || 0).toFixed(2)}</p>
              <p className="text-xs text-pink-200">Total Earned</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">{user?.total_jackpot_entries || 0}</p>
              <p className="text-xs text-pink-200">Contest Entries</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">$1M+</p>
              <p className="text-xs text-pink-200">Jackpot Potential</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform selector */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Select Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {PLATFORMS.map(p => {
              const Icon = p.icon;
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${active ? 'border-transparent text-white shadow-lg' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  style={active ? { background: p.color } : {}}
                >
                  <Icon className="w-4 h-4" /> {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Your referral link is automatically embedded: <span className="font-mono text-blue-500 truncate">{referralLink}</span></p>
        </CardContent>
      </Card>

      {/* Generate button */}
      <Button
        className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-black text-base gap-2"
        onClick={generatePosts}
        disabled={generating || selectedPlatforms.length === 0}
      >
        {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating viral posts…</> : <><Sparkles className="w-5 h-5" /> Generate Posts with AI</>}
      </Button>

      {/* Generated Posts */}
      <AnimatePresence>
        {Object.keys(posts).length > 0 && (
          <motion.div className="space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {PLATFORMS.filter(p => selectedPlatforms.includes(p.id) && posts[p.id]).map(platform => {
              const Icon = platform.icon;
              const text = posts[platform.id];
              const copied = copiedId === platform.id;
              return (
                <Card key={platform.id} className="border-0 shadow-md overflow-hidden">
                  <div className="h-1" style={{ background: platform.color }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: platform.color }}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <CardTitle className="text-sm">{platform.label} Post</CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-7"
                          onClick={() => copyPost(platform.id, text)}
                        >
                          {copied ? <><CheckCircle className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1 text-xs h-7 text-white"
                          style={{ background: platform.color }}
                          onClick={() => {
                            copyPost(platform.id, text);
                            toast.success(`Post copied! Paste it directly into ${platform.label}.`);
                          }}
                        >
                          <Share2 className="w-3 h-3" /> Post
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-100 max-h-64 overflow-y-auto">
                      {text}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Referral link embedded — every new signup earns you 10% of their lifetime profits
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={generatePosts}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Regenerate Posts
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tip */}
      <Card className="border border-purple-200 bg-purple-50">
        <CardContent className="p-4 text-xs text-purple-700">
          <p className="font-semibold mb-1">💡 How Auto-Creator drives viral growth</p>
          <p>AI analyzes your highest-earning days and game milestones to craft authentic stories. Your referral link is woven in naturally — every click that converts earns you <strong>10% of that user's profits forever</strong>. Post consistently to unlock the $1M+ jackpot potential.</p>
        </CardContent>
      </Card>
    </div>
  );
}