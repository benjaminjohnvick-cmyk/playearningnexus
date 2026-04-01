import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Trophy, RotateCcw, TrendingUp, Eye, CheckCircle2, Play, Zap } from 'lucide-react';

const IMPRESSION_THRESHOLD = 500;

function VariantCard({ variant, index, isWinner, isActive, impressions, onPromote }) {
  const letters = ['A', 'B', 'C'];
  const colors = [
    'border-blue-500/30 bg-blue-500/5',
    'border-purple-500/30 bg-purple-500/5',
    'border-orange-500/30 bg-orange-500/5',
  ];
  const textColors = ['text-blue-400', 'text-purple-400', 'text-orange-400'];
  const pct = impressions > 0 ? parseFloat(((variant.clicks / impressions) * 100).toFixed(2)) : 0;
  const progress = Math.min(100, Math.round((impressions / IMPRESSION_THRESHOLD) * 100));

  return (
    <div className={`border rounded-2xl p-4 transition-all relative ${isWinner ? 'border-yellow-500/50 bg-yellow-500/5 ring-1 ring-yellow-500/20' : colors[index]}`}>
      {isWinner && (
        <div className="absolute -top-2.5 -right-2.5">
          <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5" /> WINNER
          </span>
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-black text-2xl ${textColors[index]}`}>{letters[index]}</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{variant.headline}</p>
            <p className="text-gray-500 text-xs mt-0.5">{variant.copy}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className={`text-xl font-black ${isWinner ? 'text-yellow-400' : textColors[index]}`}>{pct}%</p>
          <p className="text-gray-600 text-[10px]">CTR</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-white">{variant.clicks}</p>
          <p className="text-gray-600 text-[10px]">Clicks</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-white">{impressions}</p>
          <p className="text-gray-600 text-[10px]">Impressions</p>
        </div>
      </div>

      {/* Impression progress */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
          <span>Progress to promotion threshold</span>
          <span>{impressions}/{IMPRESSION_THRESHOLD}</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isWinner ? 'bg-yellow-500' : 'bg-gray-600'}`}
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isWinner && impressions >= IMPRESSION_THRESHOLD && !isActive && (
        <Button onClick={() => onPromote(variant)} size="sm"
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs h-7 gap-1">
          <Zap className="w-3 h-3" /> Promote to 100% Traffic
        </Button>
      )}
      {isActive && (
        <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5">
          <CheckCircle2 className="w-3 h-3" /> Currently serving 100% traffic
        </div>
      )}
    </div>
  );
}

export default function AdMultivariateTesting({ ads }) {
  const [selectedAd, setSelectedAd] = useState(ads[0] || null);
  const [variants, setVariants] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [promotedVariant, setPromotedVariant] = useState(null);
  const [running, setRunning] = useState(false);
  const [impressions, setImpressions] = useState({ A: 0, B: 0, C: 0 });

  // Simulate click accumulation
  const simulateTick = (currentVariants) => {
    setImpressions(prev => {
      const next = { ...prev };
      ['A', 'B', 'C'].forEach(k => { next[k] = prev[k] + Math.floor(20 + Math.random() * 40); });
      return next;
    });
    setVariants(prev => prev?.map((v, i) => {
      const key = ['A', 'B', 'C'][i];
      const newImps = impressions[key] || 0;
      const ctrBase = i === 0 ? 0.045 : i === 1 ? 0.062 : 0.038; // B slightly wins
      const newClicks = v.clicks + Math.floor(newImps * ctrBase * (0.8 + Math.random() * 0.4));
      return { ...v, clicks: newClicks };
    }));
  };

  const startRotation = () => {
    setRunning(true);
    setPromotedVariant(null);
    const tick = setInterval(() => {
      simulateTick(variants);
      setImpressions(prev => {
        const next = { A: prev.A + 55, B: prev.B + 55, C: prev.C + 55 };
        if (Object.values(next).some(v => v >= IMPRESSION_THRESHOLD)) {
          clearInterval(tick);
          setRunning(false);
        }
        return next;
      });
    }, 1200);
  };

  const handleGenerate = async () => {
    if (!selectedAd) return;
    setGenerating(true);
    setVariants(null);
    setImpressions({ A: 0, B: 0, C: 0 });
    setPromotedVariant(null);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert ad copywriter. Generate 3 distinct headline + copy variations for this advertisement:

Brand: "${selectedAd.brand_name}"
Tagline: "${selectedAd.tagline || 'N/A'}"
Landing URL: "${selectedAd.landing_url}"

Each variant should have a different emotional angle:
- Variant A: Curiosity/intrigue
- Variant B: Benefit-driven/direct
- Variant C: Social proof/urgency

Return JSON with array of 3 objects, each with "headline" (max 8 words) and "copy" (max 20 words).`,
      response_json_schema: {
        type: 'object',
        properties: {
          variants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                headline: { type: 'string' },
                copy: { type: 'string' },
              }
            }
          }
        }
      }
    });

    const generated = (result.variants || []).slice(0, 3).map(v => ({ ...v, clicks: 0 }));
    setVariants(generated);
    setGenerating(false);
  };

  const handlePromote = async (variant) => {
    setPromotedVariant(variant);
    if (selectedAd) {
      await base44.entities.AdListing.update(selectedAd.id, { tagline: variant.headline });
    }
  };

  const totalImpressions = (k) => impressions[k] || 0;
  const allKeys = ['A', 'B', 'C'];

  const winnerIndex = variants ? allKeys.reduce((best, k, i) => {
    const pct = impressions[allKeys[i]] > 0 ? (variants[i]?.clicks || 0) / impressions[allKeys[i]] : 0;
    const bestPct = impressions[allKeys[best]] > 0 ? (variants[best]?.clicks || 0) / impressions[allKeys[best]] : 0;
    return pct > bestPct ? i : best;
  }, 0) : 0;

  const threshold500Reached = Object.values(impressions).some(v => v >= IMPRESSION_THRESHOLD);

  return (
    <div className="space-y-5">
      {/* Ad selector */}
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Select Ad to Test</label>
        <div className="flex flex-wrap gap-2">
          {ads.filter(a => a.status === 'active' || a.status === 'pending').map(ad => (
            <button key={ad.id} onClick={() => { setSelectedAd(ad); setVariants(null); setImpressions({ A: 0, B: 0, C: 0 }); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedAd?.id === ad.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
              {ad.brand_name}
            </button>
          ))}
          {ads.length === 0 && <p className="text-gray-600 text-xs">No active ads found. Create an ad first.</p>}
        </div>
      </div>

      {/* Generate button */}
      <Button onClick={handleGenerate} disabled={generating || !selectedAd}
        className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 w-full">
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {generating ? 'Generating 3 AI Variants...' : 'Generate 3 Copy Variants with AI'}
      </Button>

      {/* Variants */}
      {variants && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              A/B/C Variants — {threshold500Reached ? '500 impressions reached' : `Rotating across grid`}
            </p>
            {!running && !threshold500Reached && (
              <Button size="sm" onClick={startRotation}
                className="bg-green-600 hover:bg-green-500 text-white text-xs h-7 gap-1">
                <Play className="w-3 h-3" /> Simulate Rotation
              </Button>
            )}
            {running && (
              <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                <RotateCcw className="w-3 h-3 animate-spin" /> Rotating live...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {variants.map((v, i) => (
              <VariantCard
                key={i}
                variant={v}
                index={i}
                isWinner={threshold500Reached && i === winnerIndex}
                isActive={promotedVariant?.headline === v.headline}
                impressions={totalImpressions(['A', 'B', 'C'][i])}
                onPromote={handlePromote}
              />
            ))}
          </div>

          {threshold500Reached && !promotedVariant && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-2 text-xs">
              <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-300 font-bold">
                Variant {['A', 'B', 'C'][winnerIndex]} leads! Click "Promote to 100% Traffic" to lock it in.
              </span>
            </div>
          )}

          {promotedVariant && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-green-300 font-bold">
                "{promotedVariant.headline}" promoted to 100% traffic and applied as ad tagline.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}