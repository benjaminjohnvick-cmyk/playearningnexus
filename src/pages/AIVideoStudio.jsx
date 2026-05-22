import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Mic, Play, Download, Sparkles, Loader2, Link2, CheckCircle, Film, Share2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', ratio: '9:16', duration: '30–60s' },
  { id: 'instagram', label: 'Instagram Reels', emoji: '📸', ratio: '9:16', duration: '15–60s' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', emoji: '▶️', ratio: '9:16', duration: '≤60s' },
  { id: 'twitter', label: 'Twitter/X', emoji: '🐦', ratio: '16:9', duration: '≤2:20' },
  { id: 'facebook', label: 'Facebook', emoji: '👥', ratio: '16:9', duration: '≤60s' },
  { id: 'snapchat', label: 'Snapchat', emoji: '👻', ratio: '9:16', duration: '≤60s' },
];

const VOICES = [
  { id: 'river', label: 'River', desc: 'Calm, neutral' },
  { id: 'honey', label: 'Honey', desc: 'Warm, soft' },
  { id: 'sunny', label: 'Sunny', desc: 'Bright, upbeat' },
  { id: 'storm', label: 'Storm', desc: 'Authoritative' },
];

const STYLES = ['Gaming & Esports', 'Earn Money Online', 'Tech & AI', 'Lifestyle', 'Motivational', 'Tutorial'];

export default function AIVideoStudio() {
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('Gaming & Esports');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['tiktok', 'instagram']);
  const [voice, setVoice] = useState('sunny');
  const [ctaType, setCtaType] = useState('referral'); // referral | custom
  const [customCTA, setCustomCTA] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [script, setScript] = useState(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [completedVideos, setCompletedVideos] = useState([]);
  const [activeTab, setActiveTab] = useState('create');

  const { data: existingScripts = [] } = useQuery({
    queryKey: ['viralScripts', user?.id],
    queryFn: () => base44.entities.SocialMediaPost.filter({ user_id: user.id, status: 'scheduled' }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const { data: savedVideos = [] } = useQuery({
    queryKey: ['savedVideos', user?.id],
    queryFn: () => base44.entities.GeneratedImage.filter({ created_by: user.email }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const referralLink = user ? `https://gamergain.app?ref=${user.id?.slice(0, 8)}` : 'https://gamergain.app';
  const ctaText = ctaType === 'referral'
    ? `Join me on GamerGain → ${referralLink}`
    : (customCTA || `Check it out → ${referralLink}`);

  const togglePlatform = (id) =>
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const generateScript = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first'); return; }
    setGeneratingScript(true);
    setScript(null); setVoiceoverUrl(null); setThumbnailUrl(null);
    try {
      const platforms = selectedPlatforms.join(', ');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a viral short-form video script for ${platforms} in the "${style}" style about: "${topic}".

The script should:
- Be 45–75 words (optimal for 30–60 second videos)
- Hook viewers in the FIRST sentence
- Include a strong call-to-action at the end: "${ctaText}"
- Use conversational language, be energetic and direct
- Include [PAUSE], [EMPHASIS], [HOOK] markers for voiceover pacing

Also generate:
1. A punchy on-screen title (max 6 words)
2. 5 trending hashtags for each platform
3. A thumbnail image prompt (vivid, visual description)
4. Key talking points (3 bullet points)

Respond as JSON:
{
  "script": string,
  "title": string,
  "hashtags": { "tiktok": [], "instagram": [], "youtube_shorts": [], "twitter": [], "facebook": [], "snapchat": [] },
  "thumbnail_prompt": string,
  "talking_points": []
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            script: { type: 'string' },
            title: { type: 'string' },
            hashtags: { type: 'object' },
            thumbnail_prompt: { type: 'string' },
            talking_points: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      setScript(result);
      toast.success('Script generated!');
    } catch {
      toast.error('Script generation failed');
    }
    setGeneratingScript(false);
  };

  const generateVoiceover = async () => {
    if (!script?.script) return;
    try {
      toast.info('Generating AI voiceover…');
      const clean = script.script.replace(/\[.*?\]/g, '').trim();
      const result = await base44.integrations.Core.GenerateSpeech({ text: clean, voice });
      setVoiceoverUrl(result.url);
      toast.success('Voiceover ready!');
    } catch {
      toast.error('Voiceover generation failed');
    }
  };

  const generateThumbnail = async () => {
    if (!script?.thumbnail_prompt) return;
    try {
      toast.info('Generating thumbnail…');
      const result = await base44.integrations.Core.GenerateImage({
        prompt: `${script.thumbnail_prompt}. Vertical 9:16 format, bold text overlay space at top, vibrant colors, social media thumbnail style`,
      });
      setThumbnailUrl(result.url);
      toast.success('Thumbnail generated!');
    } catch {
      toast.error('Thumbnail generation failed');
    }
  };

  const produceVideos = async () => {
    if (!script) { toast.error('Generate a script first'); return; }
    setGeneratingVideo(true);
    const videos = [];
    for (const platform of selectedPlatforms) {
      try {
        const saved = await base44.entities.GeneratedImage.create({
          prompt: script.thumbnail_prompt,
          platform,
          title: script.title,
          script: script.script,
          cta: ctaText,
          hashtags: JSON.stringify(script.hashtags?.[platform] || []),
          voiceover_url: voiceoverUrl || '',
          thumbnail_url: thumbnailUrl || '',
          status: 'ready',
        });
        videos.push({ platform, id: saved.id, title: script.title });
        toast.success(`${PLATFORMS.find(p => p.id === platform)?.label} video ready!`);
      } catch {
        toast.error(`Failed for ${platform}`);
      }
    }
    setCompletedVideos(videos);
    setGeneratingVideo(false);
  };

  const loadExistingScript = (post) => {
    setScript({ script: post.content || post.post_content || '', title: post.title || 'Viral Post', hashtags: {}, talking_points: [] });
    setTopic(post.title || 'From Social Engine');
    setActiveTab('create');
    toast.success('Script loaded from Social Engine!');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 via-purple-700 to-indigo-700 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Video className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black">AI Video Studio</h1>
              <p className="text-purple-200 text-sm">Generate viral short-form videos with AI scripts, voiceovers, thumbnails & your referral CTA — for TikTok, Reels, Shorts, Twitter, Facebook & Snapchat</p>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {PLATFORMS.map(p => (
              <div key={p.id} className="bg-white/10 rounded-xl p-2 text-center text-xs">
                <div className="text-xl mb-0.5">{p.emoji}</div>
                <div className="font-bold">{p.label.split(' ')[0]}</div>
                <div className="text-purple-300 text-xs">{p.ratio}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-900 border border-gray-700 mb-8 w-full">
            <TabsTrigger value="create" className="flex-1 data-[state=active]:bg-purple-600">🎬 Create Video</TabsTrigger>
            <TabsTrigger value="social_scripts" className="flex-1 data-[state=active]:bg-purple-600">🤖 From Social Engine</TabsTrigger>
            <TabsTrigger value="library" className="flex-1 data-[state=active]:bg-purple-600">📚 My Videos</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            {/* Step 1: Script */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" /> Step 1 — Generate AI Script
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-bold mb-1 block">Video Topic / Angle</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. How I earn $50/day playing games from my phone"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-bold mb-2 block">Video Style</label>
                    <div className="flex flex-wrap gap-2">
                      {STYLES.map(s => (
                        <button key={s} onClick={() => setStyle(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${style === s ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold mb-2 block">Target Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(p => (
                        <button key={p.id} onClick={() => togglePlatform(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPlatforms.includes(p.id) ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          {p.emoji} {p.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* CTA */}
                <div>
                  <label className="text-xs text-gray-400 font-bold mb-2 block">Call-to-Action Overlay</label>
                  <div className="flex gap-2 mb-2">
                    {['referral', 'custom'].map(t => (
                      <button key={t} onClick={() => setCtaType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ctaType === t ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        {t === 'referral' ? '🔗 My Referral Link' : '✏️ Custom CTA'}
                      </button>
                    ))}
                  </div>
                  {ctaType === 'custom' && (
                    <input className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                      placeholder="Your custom CTA text" value={customCTA} onChange={e => setCustomCTA(e.target.value)} />
                  )}
                  {ctaType === 'referral' && (
                    <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2 text-sm text-green-300">
                      <Link2 className="w-4 h-4" />{referralLink}
                    </div>
                  )}
                </div>
                <Button onClick={generateScript} disabled={generatingScript || !topic}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold h-12">
                  {generatingScript ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Script…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Script with AI</>}
                </Button>
              </CardContent>
            </Card>

            {/* Script Preview */}
            {script && (
              <Card className="bg-gray-900 border-purple-700 border-2">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span>📝 "{script.title}"</span>
                    <Button size="sm" variant="outline" onClick={generateScript} className="border-gray-700 text-gray-300 gap-1">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
                    {script.script}
                  </div>
                  {script.talking_points?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-2">KEY TALKING POINTS</p>
                      {script.talking_points.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-300 mb-1">
                          <span className="text-purple-400 font-bold">{i + 1}.</span>{p}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Hashtags */}
                  {selectedPlatforms.slice(0, 2).map(pid => script.hashtags?.[pid]?.length > 0 && (
                    <div key={pid}>
                      <p className="text-xs text-gray-500 font-bold mb-1">{PLATFORMS.find(p => p.id === pid)?.emoji} Hashtags</p>
                      <div className="flex flex-wrap gap-1">
                        {script.hashtags[pid].map((h, i) => <Badge key={i} className="bg-gray-700 text-gray-300 text-xs">{h}</Badge>)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Voiceover */}
            {script && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Mic className="w-5 h-5 text-blue-400" /> Step 2 — AI Voiceover
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {VOICES.map(v => (
                      <button key={v.id} onClick={() => setVoice(v.id)}
                        className={`p-3 rounded-xl border text-center transition-all ${voice === v.id ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                        <Mic className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                        <p className="text-sm font-bold text-white">{v.label}</p>
                        <p className="text-xs text-gray-400">{v.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={generateVoiceover} className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold gap-2">
                      <Mic className="w-4 h-4" /> Generate Voiceover
                    </Button>
                    <Button onClick={generateThumbnail} className="flex-1 bg-orange-600 hover:bg-orange-700 font-bold gap-2">
                      <Film className="w-4 h-4" /> Generate Thumbnail
                    </Button>
                  </div>
                  {voiceoverUrl && (
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-bold mb-2">🎙️ AI Voiceover Preview</p>
                      <audio controls src={voiceoverUrl} className="w-full" />
                    </div>
                  )}
                  {thumbnailUrl && (
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-bold mb-2">🖼️ Thumbnail Preview</p>
                      <img src={thumbnailUrl} alt="thumbnail" className="rounded-xl max-h-48 object-cover w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Produce */}
            {script && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-pink-400" /> Step 3 — Produce & Export
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-2">
                    {selectedPlatforms.map(pid => {
                      const p = PLATFORMS.find(x => x.id === pid);
                      return (
                        <div key={pid} className="flex items-center justify-between text-gray-300">
                          <span>{p?.emoji} {p?.label}</span>
                          <span className="text-xs text-gray-500">{p?.ratio} · {p?.duration}</span>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-gray-700 text-xs text-gray-500">
                      Script + voiceover + thumbnail + referral overlay will be packaged for each platform
                    </div>
                  </div>
                  <Button onClick={produceVideos} disabled={generatingVideo}
                    className="w-full bg-gradient-to-r from-pink-600 to-red-600 font-black h-12 text-base gap-2">
                    {generatingVideo ? <><Loader2 className="w-5 h-5 animate-spin" />Producing Videos…</> : <><Video className="w-5 h-5" />Produce All Videos</>}
                  </Button>
                  {completedVideos.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {completedVideos.map((v, i) => {
                        const p = PLATFORMS.find(x => x.id === v.platform);
                        return (
                          <div key={i} className="flex items-center justify-between bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-300 font-bold">{p?.emoji} {p?.label} — Ready</span>
                            </div>
                            <Button size="sm" className="bg-green-700 hover:bg-green-600 gap-1">
                              <Share2 className="w-3 h-3" /> Share
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* From Social Engine */}
          <TabsContent value="social_scripts">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" /> Import Scripts from AI Social Media Engine
                </CardTitle>
              </CardHeader>
              <CardContent>
                {existingScripts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No viral scripts found yet.</p>
                    <p className="text-xs mt-1">Go to the AI Social Media Engine to generate scripts first.</p>
                    <a href="/AISocialMediaEngine">
                      <Button className="mt-4 bg-purple-600">Open Social Engine</Button>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingScripts.map((post, i) => (
                      <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{post.title || `Post ${i + 1}`}</p>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{post.content || post.post_content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-gray-700 text-gray-300 text-xs capitalize">{post.platform}</Badge>
                              <Badge className="bg-gray-700 text-gray-300 text-xs capitalize">{post.status}</Badge>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => loadExistingScript(post)}
                            className="bg-purple-600 hover:bg-purple-700 gap-1 flex-shrink-0">
                            <Video className="w-3 h-3" /> Use Script
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Library */}
          <TabsContent value="library">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">My Video Library</CardTitle>
              </CardHeader>
              <CardContent>
                {savedVideos.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No videos produced yet. Create your first one!</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {savedVideos.map((v, i) => (
                      <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="rounded-lg mb-3 w-full h-32 object-cover" />}
                        <p className="text-sm font-bold text-white mb-1">{v.title || 'Untitled Video'}</p>
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <Badge className="bg-pink-900 text-pink-300 text-xs capitalize">{v.platform}</Badge>
                          <Badge className="bg-green-900 text-green-300 text-xs">{v.status || 'ready'}</Badge>
                        </div>
                        <div className="flex gap-2">
                          {v.voiceover_url && <audio controls src={v.voiceover_url} className="flex-1 h-8" />}
                          <Button size="sm" className="bg-indigo-700 gap-1"><Share2 className="w-3 h-3" />Share</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}