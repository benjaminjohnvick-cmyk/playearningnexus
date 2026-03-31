import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Loader2, Copy, CheckCircle, RefreshCw, Tag,
  MessageSquare, Zap, TrendingUp, Brain
} from 'lucide-react';
import { toast } from 'sonner';

const COPY_TYPES = [
  { key: 'taglines', label: 'Tagline Variations', icon: <Tag className="w-3 h-3" /> },
  { key: 'cta', label: 'Calls-to-Action', icon: <Zap className="w-3 h-3" /> },
  { key: 'descriptions', label: 'Ad Descriptions', icon: <MessageSquare className="w-3 h-3" /> },
];

export default function AiAdCopyEnhancer({ ads }) {
  const [mode, setMode] = useState('improve'); // 'improve' | 'generate'
  const [selectedAd, setSelectedAd] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [activeType, setActiveType] = useState('taglines');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [learningInsight, setLearningInsight] = useState('');

  const adWithData = ads.find(a => a.id === selectedAd);

  const generate = async () => {
    setLoading(true);
    setResults(null);

    let prompt;
    if (mode === 'improve' && adWithData) {
      const ctr = adWithData.total_clicks > 0
        ? ((adWithData.surveys_completed / adWithData.total_clicks) * 100).toFixed(1) : 'N/A';
      prompt = `You are an expert ad copywriter. Analyze this ad and generate improved copy.

Ad details:
- Brand: ${adWithData.brand_name}
- Current tagline: "${adWithData.tagline || 'none'}"
- Performance: ${adWithData.total_clicks} clicks, ${adWithData.surveys_completed} completions, ${ctr}% CTR
- Budget spent: $${(adWithData.total_spent || 0).toFixed(2)}
- Grid tier: ${adWithData.grid_tier || 'Standard'}

Generate improved copy specifically optimized for higher survey completion rates on a gaming platform audience (18-35, gamers). Focus on urgency, rewards, and curiosity.

Return JSON with:
- taglines: array of 5 punchy taglines (max 8 words each), ordered best to worst predicted CTR
- cta: array of 5 call-to-action phrases (max 4 words each)
- descriptions: array of 3 ad descriptions (max 20 words each)
- learning_insight: 1 sentence on why current performance is what it is and what copy change will help most`;
    } else {
      prompt = `You are an expert ad copywriter for gaming & entertainment platforms. Generate high-converting ad copy.

Brand: ${brandName || 'Unknown Brand'}
Product/Service: ${productDesc || 'Not provided'}
Target audience: Gamers aged 18-35 on a gaming rewards platform.

Generate copy optimized for survey completion rate (users need to engage for 60 seconds).

Return JSON with:
- taglines: array of 5 punchy taglines (max 8 words each)
- cta: array of 5 call-to-action phrases (max 4 words each)
- descriptions: array of 3 ad descriptions (max 20 words each)
- learning_insight: 1 sentence on the best copy strategy for this brand`;
    }

    const data = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          taglines: { type: 'array', items: { type: 'string' } },
          cta: { type: 'array', items: { type: 'string' } },
          descriptions: { type: 'array', items: { type: 'string' } },
          learning_insight: { type: 'string' },
        },
      },
    });

    setResults(data);
    setLearningInsight(data.learning_insight || '');

    // Store insight to learning memory
    if (adWithData) {
      await base44.entities.AdLearningMemory.create({
        owner_user_id: adWithData.owner_user_id,
        ad_id: adWithData.id,
        brand_name: adWithData.brand_name,
        tagline: adWithData.tagline,
        total_clicks: adWithData.total_clicks || 0,
        surveys_completed: adWithData.surveys_completed || 0,
        total_spent: adWithData.total_spent || 0,
        ctr: adWithData.total_clicks > 0 ? (adWithData.surveys_completed / adWithData.total_clicks * 100) : 0,
        ai_insights: data.learning_insight || '',
        snapshot_date: new Date().toISOString(),
      }).catch(() => null);
    }

    setLoading(false);
  };

  const applyTagline = async (tagline) => {
    if (!adWithData) return;
    await base44.entities.AdListing.update(adWithData.id, { tagline });
    toast.success(`Tagline applied to "${adWithData.brand_name}"`);
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 2000);
    toast.success('Copied!');
  };

  const activeItems = results?.[activeType] || [];

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-2 bg-gray-800/60 rounded-xl p-1 w-fit">
        {[{ key: 'improve', label: '✨ Improve Existing Ad' }, { key: 'generate', label: '🚀 Generate from Scratch' }].map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setResults(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === m.key ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
        {mode === 'improve' ? (
          <div>
            <p className="text-gray-500 text-xs mb-2 font-bold uppercase tracking-wider">Select Ad to Improve</p>
            {ads.length === 0 ? (
              <p className="text-gray-600 text-sm">No ads yet — create one first.</p>
            ) : (
              <select value={selectedAd} onChange={e => setSelectedAd(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">Choose an ad...</option>
                {ads.map(ad => (
                  <option key={ad.id} value={ad.id}>
                    {ad.brand_name} — {ad.surveys_completed || 0} completions
                  </option>
                ))}
              </select>
            )}
            {adWithData && (
              <div className="mt-2 flex items-center gap-3 bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-400">
                <span>Current: <span className="text-gray-200 italic">"{adWithData.tagline || 'none'}"</span></span>
                <span>•</span>
                <span>CTR: <span className="text-white font-bold">
                  {adWithData.total_clicks > 0 ? (adWithData.surveys_completed / adWithData.total_clicks * 100).toFixed(1) : '0'}%
                </span></span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Input value={brandName} onChange={e => setBrandName(e.target.value)}
              placeholder="Brand / business name"
              className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
            <Input value={productDesc} onChange={e => setProductDesc(e.target.value)}
              placeholder="Product or service description (e.g. 'Online gaming accessories')"
              className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
          </div>
        )}

        <Button onClick={generate}
          disabled={loading || (mode === 'improve' && !selectedAd) || (mode === 'generate' && !brandName)}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2 w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating copy...' : 'Generate AI Copy'}
        </Button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* AI learning insight */}
          {learningInsight && (
            <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <Brain className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-purple-300 text-xs">{learningInsight}</p>
            </div>
          )}

          {/* Copy type tabs */}
          <div className="flex gap-2">
            {COPY_TYPES.map(t => (
              <button key={t.key} onClick={() => setActiveType(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  activeType === t.key
                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                    : 'border-gray-700 text-gray-500 hover:text-white'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="space-y-2">
            {activeItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
                <span className="text-yellow-500 font-black text-xs mt-0.5 flex-shrink-0">#{i + 1}</span>
                <p className="text-gray-200 text-sm flex-1 italic">"{item}"</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {activeType === 'taglines' && adWithData && (
                    <button onClick={() => applyTagline(item)}
                      className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg hover:bg-green-500/30 font-bold">
                      Apply
                    </button>
                  )}
                  <button onClick={() => copyText(item)}
                    className="text-gray-500 hover:text-white transition-colors p-1">
                    {copied === item ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate variations
          </button>
        </div>
      )}
    </div>
  );
}