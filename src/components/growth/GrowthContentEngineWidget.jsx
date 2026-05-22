import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Zap, Hash, Eye, Rocket, Loader2, RefreshCw, CheckCircle, ChevronRight, Send } from 'lucide-react';
import { toast } from 'sonner';

const URGENCY_STYLE = {
  now: 'bg-red-100 text-red-700 border-red-200',
  this_week: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  evergreen: 'bg-green-100 text-green-700 border-green-200',
};

const PLATFORM_EMOJI = { tiktok: '🎵', instagram: '📸', twitter: '🐦', facebook: '👥', snapchat: '👻', youtube_shorts: '▶️' };

export default function GrowthContentEngineWidget({ onUseTopic, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [data, setData] = useState(null);
  const [activeSection, setActiveSection] = useState('topics');

  const analyze = async (autoDeployToSocial = false) => {
    if (autoDeployToSocial) setDeploying(true);
    else setLoading(true);

    try {
      const res = await base44.functions.invoke('growthContentEngine', { autoDeployToSocial });
      setData(res.data);
      if (autoDeployToSocial && res.data?.deployed_posts?.length > 0) {
        toast.success(`🚀 ${res.data.deployed_posts.length} scripts deployed to social media!`);
      } else if (!autoDeployToSocial) {
        toast.success('Trending topics & hooks refreshed!');
      }
    } catch {
      toast.error('Analysis failed — please try again');
    }
    setLoading(false);
    setDeploying(false);
  };

  const handleUseTopic = (topic) => {
    if (onUseTopic) onUseTopic(topic);
    toast.success(`Topic loaded: "${topic.topic}"`);
  };

  if (compact && !data) {
    return (
      <button onClick={() => analyze(false)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
        {loading ? 'Analyzing…' : '🔥 Get Trending Topics'}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-sm text-gray-900">AI Growth Content Engine</p>
            {data && <p className="text-xs text-gray-500">Updated {new Date(data.generated_at || Date.now()).toLocaleTimeString()}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => analyze(false)} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? 'Analyzing…' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={() => analyze(true)} disabled={deploying}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold gap-1">
            {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            {deploying ? 'Deploying…' : 'Deploy All to Social'}
          </Button>
        </div>
      </div>

      {!data && !loading && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-8 text-center">
          <TrendingUp className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">Real-Time Affiliate Trend Analysis</p>
          <p className="text-sm text-gray-600 mb-4">Scans top-performing posts, affiliate sales data, and platform trends to suggest high-converting content topics, hashtags, and visual hooks.</p>
          <Button onClick={() => analyze(false)} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold gap-2">
            <Zap className="w-4 h-4" /> Analyze Trends Now
          </Button>
        </div>
      )}

      {loading && (
        <div className="bg-white border rounded-2xl p-8 text-center">
          <TrendingUp className="w-10 h-10 text-emerald-600 mx-auto mb-3 animate-pulse" />
          <p className="font-bold text-gray-900 mb-1">Scanning affiliate trends…</p>
          <p className="text-xs text-gray-500">Analyzing top posts, sales data, and platform patterns</p>
        </div>
      )}

      {data && (
        <>
          {/* Insights summary */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl p-4 text-white text-sm">
            <p className="font-bold mb-1">📊 AI Insights</p>
            <p className="text-emerald-100 leading-relaxed">{data.insights_summary}</p>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { id: 'topics', icon: TrendingUp, label: 'Topics' },
              { id: 'hashtags', icon: Hash, label: 'Hashtags' },
              { id: 'hooks', icon: Eye, label: 'Visual Hooks' },
              { id: 'scripts', icon: Send, label: 'Ready Scripts' },
            ].map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${activeSection === s.id ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>
                <s.icon className="w-3.5 h-3.5" />{s.label}
              </button>
            ))}
          </div>

          {/* Trending Topics */}
          {activeSection === 'topics' && (
            <div className="space-y-2">
              {(data.trending_topics || []).map((t, i) => (
                <div key={i} className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-emerald-200 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-black text-gray-900 text-sm">{t.topic}</p>
                        <Badge className={`text-xs border ${URGENCY_STYLE[t.urgency] || 'bg-gray-100 text-gray-600'}`}>
                          {t.urgency === 'now' ? '🔥 NOW' : t.urgency === 'this_week' ? '📅 This Week' : '🌿 Evergreen'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{t.why_trending}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>Predicted CTR: <strong className="text-green-600">{t.predicted_ctr}%</strong></span>
                        <span>{(t.platforms || []).map(p => PLATFORM_EMOJI[p] || p).join(' ')}</span>
                      </div>
                    </div>
                    {onUseTopic && (
                      <Button size="sm" onClick={() => handleUseTopic(t)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-shrink-0">
                        Use <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hashtags */}
          {activeSection === 'hashtags' && (
            <div className="space-y-3">
              {(data.top_hashtag_sets || []).map((hs, i) => (
                <div key={i} className="bg-white border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-900">
                      {PLATFORM_EMOJI[hs.platform] || '📱'} {hs.platform}
                    </span>
                    <Badge className="bg-green-100 text-green-700 text-xs">{hs.engagement_boost}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(hs.hashtags || []).map((h, j) => (
                      <button key={j} onClick={() => { navigator.clipboard?.writeText(h); toast.success('Copied!'); }}
                        className="px-2 py-1 bg-gray-100 hover:bg-emerald-100 rounded-lg text-xs text-gray-700 font-mono transition-colors">
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Visual Hooks */}
          {activeSection === 'hooks' && (
            <div className="grid sm:grid-cols-2 gap-3">
              {(data.visual_hooks || []).map((h, i) => (
                <div key={i} className="bg-white border-2 border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-purple-500" />
                    <Badge className="bg-purple-100 text-purple-700 text-xs capitalize">{h.platform}</Badge>
                  </div>
                  <p className="font-black text-gray-900 text-sm mb-1">"{h.hook_text}"</p>
                  <p className="text-xs text-gray-500 mb-2">Style: {h.visual_style}</p>
                  <p className="text-xs text-gray-400 italic leading-snug">🖼️ {h.example_thumbnail_prompt}</p>
                </div>
              ))}
            </div>
          )}

          {/* Ready-to-Deploy Scripts */}
          {activeSection === 'scripts' && (
            <div className="space-y-3">
              {(data.ready_to_deploy_scripts || []).map((s, i) => (
                <div key={i} className="bg-white border-2 border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{PLATFORM_EMOJI[s.platform] || '📱'}</span>
                      <span className="font-bold text-sm text-gray-900">{s.topic}</span>
                    </div>
                    <div className="flex gap-2">
                      {onUseTopic && (
                        <Button size="sm" variant="outline" onClick={() => handleUseTopic({ topic: s.topic, script: s.script })}
                          className="text-xs gap-1">
                          <Zap className="w-3 h-3" /> Use in Studio
                        </Button>
                      )}
                      <Button size="sm" onClick={() => analyze(true)} disabled={deploying}
                        className="bg-emerald-600 text-white text-xs gap-1">
                        <Send className="w-3 h-3" /> Deploy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono leading-relaxed mb-2">
                    {s.script}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(s.hashtags || []).map((h, j) => (
                      <span key={j} className="text-xs text-teal-600 font-mono">{h}</span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Deploy all button */}
              <Button onClick={() => analyze(true)} disabled={deploying}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black h-12 gap-2">
                {deploying ? <><Loader2 className="w-4 h-4 animate-spin" />Deploying to all platforms…</> :
                  <><Rocket className="w-4 h-4" />Deploy All 3 Scripts Across All Platforms</>}
              </Button>
            </div>
          )}

          {/* Deployed confirmation */}
          {data.deployed_posts?.length > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4">
              <p className="text-sm font-black text-emerald-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {data.deployed_posts.length} Scripts Deployed to Social Media
              </p>
              <div className="flex flex-wrap gap-2">
                {data.deployed_posts.map((p, i) => (
                  <Badge key={i} className="bg-emerald-100 text-emerald-700">
                    {PLATFORM_EMOJI[p.platform]} {p.topic?.slice(0, 20)}…
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}