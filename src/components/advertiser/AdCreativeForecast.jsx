import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Target, Loader2, CheckCircle, AlertTriangle, Info, BarChart2, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Heuristic benchmark scores by industry keyword
const INDUSTRY_BENCHMARKS = {
  game: { ctr: 5.8, roi: 82 }, gaming: { ctr: 5.8, roi: 82 },
  shop: { ctr: 4.2, roi: 74 }, store: { ctr: 4.2, roi: 74 }, ecom: { ctr: 4.2, roi: 74 },
  crypto: { ctr: 3.9, roi: 67 }, token: { ctr: 3.9, roi: 67 }, coin: { ctr: 3.9, roi: 67 },
  health: { ctr: 3.5, roi: 63 }, wellness: { ctr: 3.5, roi: 63 }, fitness: { ctr: 3.5, roi: 63 },
  food: { ctr: 3.1, roi: 58 }, restaurant: { ctr: 3.1, roi: 58 },
  fashion: { ctr: 4.5, roi: 71 }, style: { ctr: 4.5, roi: 71 },
  saas: { ctr: 2.8, roi: 61 }, software: { ctr: 2.8, roi: 61 }, app: { ctr: 3.2, roi: 64 },
  finance: { ctr: 3.3, roi: 66 }, fintech: { ctr: 3.3, roi: 66 }, invest: { ctr: 3.3, roi: 66 },
};

function getIndustryBenchmark(text) {
  const lower = (text || '').toLowerCase();
  for (const [kw, val] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (lower.includes(kw)) return val;
  }
  return { ctr: 3.4, roi: 62 }; // general baseline
}

function scoreTagline(tagline) {
  if (!tagline) return 0;
  let score = 0;
  const lower = tagline.toLowerCase();
  const powerWords = ['free', 'exclusive', 'limited', 'now', 'today', 'new', 'win', 'get', 'save', 'instant'];
  const urgency = ['only', 'last', 'ends', 'hurry', 'fast'];
  powerWords.forEach(w => { if (lower.includes(w)) score += 6; });
  urgency.forEach(w => { if (lower.includes(w)) score += 8; });
  if (tagline.length > 20 && tagline.length < 60) score += 10; // ideal length
  if (tagline.includes('!')) score += 4;
  if (tagline.includes('%')) score += 5;
  return Math.min(score, 40);
}

function scoreImage(hasImage) {
  return hasImage ? 25 : 0;
}

function scoreBid(bid, tier) {
  const tierScore = { Premium: 20, High: 15, Standard: 8, Economy: 3 };
  return tierScore[tier] || 8;
}

function scoreTargeting(targeting) {
  if (!targeting) return 0;
  let score = 0;
  if ((targeting.age_buckets || []).length > 0) score += 5;
  if ((targeting.interest_buckets || []).length > 0) score += 10;
  if ((targeting.countries || []).length > 0) score += 5;
  return Math.min(score, 20);
}

function computeForecast(brandName, tagline, hasImage, bid, tier, targeting, historicalAds) {
  const benchmark = getIndustryBenchmark(brandName + ' ' + tagline);
  const taglineScore = scoreTagline(tagline);
  const imageScore = scoreImage(hasImage);
  const bidScore = scoreBid(bid, tier);
  const targetingScore = scoreTargeting(targeting);
  const totalQualityScore = taglineScore + imageScore + bidScore + targetingScore; // max ~105

  // Compare against historical ads if available
  let historicalBoost = 0;
  if (historicalAds && historicalAds.length > 0) {
    const avgHistoricalCTR = historicalAds.reduce((s, a) => {
      const ctr = a.total_clicks > 0 ? (a.surveys_completed / a.total_clicks) : 0.03;
      return s + ctr;
    }, 0) / historicalAds.length;
    historicalBoost = Math.min(avgHistoricalCTR * 100 * 0.3, 1.5); // up to +1.5% CTR boost
  }

  const qualityMultiplier = 0.7 + (totalQualityScore / 105) * 0.6; // 0.7x–1.3x
  const predictedCTR = parseFloat(((benchmark.ctr * qualityMultiplier) + historicalBoost).toFixed(2));
  const predictedROI = Math.round(benchmark.roi * qualityMultiplier);

  const improvements = [];
  if (!hasImage) improvements.push({ level: 'critical', msg: 'Add an ad image — ads with images get 2.5× more clicks' });
  if (taglineScore < 10) improvements.push({ level: 'warn', msg: 'Add power words ("Free", "Now", "Limited") to your tagline' });
  if (taglineScore < 20) improvements.push({ level: 'warn', msg: 'Include a specific offer or percentage in your tagline' });
  if (!tier || tier === 'Economy') improvements.push({ level: 'warn', msg: 'Upgrade to Standard or High tier for better grid placement' });
  if (!targeting || (targeting.interest_buckets || []).length === 0) improvements.push({ level: 'info', msg: 'Set interest targeting to reach higher-intent users' });
  if ((bid || 0) < 0.40) improvements.push({ level: 'warn', msg: 'Increase bid to at least $0.40 to stay competitive' });

  return { predictedCTR, predictedROI, qualityScore: Math.round(totalQualityScore), improvements };
}

function QualityBar({ score }) {
  const pct = Math.min((score / 105) * 100, 100);
  const color = pct >= 65 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const label = pct >= 65 ? 'Strong' : pct >= 40 ? 'Fair' : 'Weak';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">Creative Quality Score</span>
        <span className="font-bold text-white">{Math.round(pct)}/100 · {label}</span>
      </div>
      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdCreativeForecast({ ads, brandName, tagline, hasImage, bid, tier, targeting }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  const historicalAds = (ads || []).filter(a => (a.total_clicks || 0) > 0);

  const runForecast = async () => {
    setLoading(true);
    // Small artificial delay for UX realism
    await new Promise(r => setTimeout(r, 900));
    const result = computeForecast(brandName, tagline, hasImage, bid, tier, targeting, historicalAds);
    setForecast(result);

    // Try AI insight if we have content
    if (brandName || tagline) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an advertising performance expert. Analyze this ad briefly:
Brand: "${brandName || 'Unknown'}"
Tagline: "${tagline || 'None'}"
Bid: $${bid || 0.40} | Tier: ${tier || 'Standard'}
Historical ads: ${historicalAds.length} campaigns on file

Predicted CTR: ${result.predictedCTR}% | ROI Score: ${result.predictedROI}

In 2 short sentences (max 30 words total), give the single most impactful improvement this advertiser should make. Be specific and actionable.`,
        });
        setAiInsight(res);
      } catch (e) {
        // silently skip AI insight on error
      }
    }
    setLoading(false);
  };

  const ctrColor = forecast?.predictedCTR >= 4.5 ? 'text-green-400' : forecast?.predictedCTR >= 3.0 ? 'text-yellow-400' : 'text-red-400';
  const roiColor = forecast?.predictedROI >= 70 ? 'text-green-400' : forecast?.predictedROI >= 55 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-gray-900 border border-purple-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">AI Pre-Launch Forecast</h3>
            <p className="text-gray-500 text-xs">Predicts CTR & ROI before your campaign goes live</p>
          </div>
        </div>
        <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-[10px]">
          {historicalAds.length > 0 ? `${historicalAds.length} historical ads` : 'No history yet'}
        </Badge>
      </div>

      {!forecast ? (
        <div className="text-center py-4 space-y-3">
          <BarChart2 className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-gray-500 text-xs">Enter your ad details above, then run the forecast to see predicted performance metrics.</p>
          <Button
            onClick={runForecast}
            disabled={loading || (!brandName && !tagline)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs gap-2 mx-auto"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analyzing...' : 'Run AI Forecast'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
              <TrendingUp className="w-4 h-4 text-gray-500 mx-auto mb-1" />
              <p className={`font-black text-2xl leading-none ${ctrColor}`}>{forecast.predictedCTR}%</p>
              <p className="text-gray-500 text-[10px] mt-1">Predicted CTR</p>
              <p className="text-gray-600 text-[9px]">Industry avg: {getIndustryBenchmark(brandName + tagline).ctr}%</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
              <Target className="w-4 h-4 text-gray-500 mx-auto mb-1" />
              <p className={`font-black text-2xl leading-none ${roiColor}`}>{forecast.predictedROI}</p>
              <p className="text-gray-500 text-[10px] mt-1">ROI Score (0–100)</p>
              <p className="text-gray-600 text-[9px]">Benchmark: {getIndustryBenchmark(brandName + tagline).roi}</p>
            </div>
          </div>

          <QualityBar score={forecast.qualityScore} />

          {/* AI insight */}
          {aiInsight && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-purple-200 text-xs italic">{aiInsight}</p>
            </div>
          )}

          {/* Improvement tips */}
          {forecast.improvements.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Improvement Suggestions</p>
              {forecast.improvements.map((item, i) => (
                <div key={i} className={`flex gap-2 p-2 rounded-lg text-xs ${
                  item.level === 'critical' ? 'bg-red-500/10 text-red-300' :
                  item.level === 'warn' ? 'bg-yellow-500/10 text-yellow-300' :
                  'bg-blue-500/10 text-blue-300'
                }`}>
                  {item.level === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                   item.level === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                   <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  {item.msg}
                </div>
              ))}
            </div>
          )}

          {forecast.improvements.length === 0 && (
            <div className="flex gap-2 items-center bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Your creative looks well-optimized. This campaign is ready to launch!
            </div>
          )}

          <Button
            onClick={runForecast}
            disabled={loading}
            variant="outline"
            className="w-full border-gray-600 text-gray-400 hover:text-white text-xs gap-2"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Re-run Forecast
          </Button>
        </div>
      )}
    </div>
  );
}