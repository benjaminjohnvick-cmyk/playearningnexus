import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, Target, CheckCircle2, AlertTriangle, Zap, BarChart2 } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const TIERS = ['Economy', 'Standard', 'High', 'Premium'];
const TIER_CTR_BASE = { Economy: 1.8, Standard: 2.9, High: 3.8, Premium: 5.1 };

function ScoreGauge({ label, value, max, color, unit = '' }) {
  const pct = Math.min(100, (value / max) * 100);
  const colors = { green: 'bg-green-500', yellow: 'bg-yellow-500', blue: 'bg-blue-500', purple: 'bg-purple-500', orange: 'bg-orange-500' };
  const textColors = { green: 'text-green-400', yellow: 'text-yellow-400', blue: 'text-blue-400', purple: 'text-purple-400', orange: 'text-orange-400' };
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-gray-400 text-xs font-bold">{label}</p>
        <p className={`text-lg font-black ${textColors[color]}`}>{value}{unit}</p>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecommendationBadge({ text, type }) {
  const styles = { good: 'bg-green-500/10 text-green-300 border-green-500/20', warn: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20', tip: 'bg-blue-500/10 text-blue-300 border-blue-500/20' };
  const icons = { good: <CheckCircle2 className="w-3 h-3" />, warn: <AlertTriangle className="w-3 h-3" />, tip: <Zap className="w-3 h-3" /> };
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs ${styles[type]}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[type]}</span>
      <span>{text}</span>
    </div>
  );
}

export default function AdLaunchForecaster({ ads }) {
  const [form, setForm] = useState({ brand_name: '', tagline: '', bid: 0.40, tier: 'Standard', hasImage: true, demographics: [] });
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  const DEMO_OPTIONS = ['18-24 Gaming', '25-34 Tech', '13-17 Mobile', '35-44 Finance', '18-24 Sports', '25-34 Health'];
  const toggleDemo = (d) => setForm(f => ({ ...f, demographics: f.demographics.includes(d) ? f.demographics.filter(x => x !== d) : [...f.demographics, d] }));

  const avgHistorical = ads.length > 0 ? {
    avgCTR: ads.reduce((s, a) => s + (a.total_clicks > 0 ? (a.surveys_completed / a.total_clicks) * 100 : 0), 0) / ads.length,
    avgROI: ads.reduce((s, a) => s + (a.total_spent > 0 ? (a.surveys_completed * a.bid_amount) / a.total_spent : 0), 0) / ads.length,
    avgCompletionRate: ads.reduce((s, a) => s + (a.surveys_started > 0 ? a.surveys_completed / a.surveys_started * 100 : 0), 0) / ads.length,
  } : { avgCTR: 2.5, avgROI: 1.0, avgCompletionRate: 68 };

  const handleForecast = async () => {
    if (!form.brand_name) return;
    setLoading(true);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an ad performance forecasting model for a gaming rewards platform. 

Historical performance data from ${ads.length} existing campaigns:
- Average CTR: ${avgHistorical.avgCTR.toFixed(2)}%
- Average ROI: ${avgHistorical.avgROI.toFixed(2)}x
- Average survey completion rate: ${avgHistorical.avgCompletionRate.toFixed(1)}%

New draft ad details:
- Brand: "${form.brand_name}"
- Tagline: "${form.tagline || 'None provided'}"
- Bid: $${form.bid}
- Grid Tier: ${form.tier} (base CTR: ~${TIER_CTR_BASE[form.tier]}%)
- Has Image: ${form.hasImage}
- Target Demographics: ${form.demographics.join(', ') || 'Not specified'}

Predict performance for this new ad. Consider:
1. Tagline quality and click appeal
2. Bid competitiveness for the tier
3. Demographics alignment with platform audience
4. Image presence impact (+20-30% CTR boost)

Return JSON with precise numeric predictions and actionable recommendations.`,
      response_json_schema: {
        type: 'object',
        properties: {
          predicted_ctr: { type: 'number' },
          predicted_conversion_rate: { type: 'number' },
          predicted_completions_30d: { type: 'number' },
          predicted_roi: { type: 'number' },
          confidence_score: { type: 'number' },
          quality_score: { type: 'number' },
          recommendations: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, type: { type: 'string' } } } },
          launch_readiness: { type: 'string' },
        }
      }
    });

    setForecast(result);
    setLoading(false);
  };

  const radarData = forecast ? [
    { metric: 'CTR', value: Math.min(100, (forecast.predicted_ctr / 8) * 100) },
    { metric: 'Conv Rate', value: Math.min(100, (forecast.predicted_conversion_rate / 80) * 100) },
    { metric: 'ROI', value: Math.min(100, (forecast.predicted_roi / 3) * 100) },
    { metric: 'Quality', value: forecast.quality_score || 0 },
    { metric: 'Confidence', value: forecast.confidence_score || 0 },
  ] : [];

  const readinessColor = { 'Ready': 'green', 'Needs Work': 'yellow', 'Not Ready': 'red' };

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Draft Ad Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Brand Name *</label>
            <input value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
              placeholder="e.g. My App, Nike" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Tagline</label>
            <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder="e.g. Play. Earn. Win." className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Bid Amount ($)</label>
            <input type="number" step="0.05" min="0.20" max="1.50" value={form.bid}
              onChange={e => setForm(f => ({ ...f, bid: parseFloat(e.target.value) || 0.40 }))}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Grid Tier</label>
            <div className="flex gap-1.5">
              {TIERS.map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tier: t }))}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${form.tier === t ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 font-bold block mb-1.5">Target Demographics</label>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_OPTIONS.map(d => (
              <button key={d} onClick={() => toggleDemo(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${form.demographics.includes(d) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setForm(f => ({ ...f, hasImage: !f.hasImage }))}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${form.hasImage ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
            {form.hasImage && <span className="text-white text-[10px] font-black">✓</span>}
          </button>
          <span className="text-gray-400 text-xs">Ad has image ready (+25% CTR boost)</span>
        </div>
      </div>

      <Button onClick={handleForecast} disabled={loading || !form.brand_name}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Analyzing historical data...' : 'Generate AI Launch Forecast'}
      </Button>

      {forecast && (
        <div className="space-y-4">
          {/* Launch readiness */}
          <div className={`border rounded-2xl p-4 flex items-center gap-3 ${
            forecast.launch_readiness === 'Ready' ? 'border-green-500/30 bg-green-500/5' :
            forecast.launch_readiness === 'Needs Work' ? 'border-yellow-500/30 bg-yellow-500/5' :
            'border-red-500/30 bg-red-500/5'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              forecast.launch_readiness === 'Ready' ? 'bg-green-500/20' : forecast.launch_readiness === 'Needs Work' ? 'bg-yellow-500/20' : 'bg-red-500/20'
            }`}>
              {forecast.launch_readiness === 'Ready' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div>
              <p className="text-white font-black">Launch Readiness: {forecast.launch_readiness}</p>
              <p className="text-gray-400 text-xs">Confidence: {forecast.confidence_score}% | Quality Score: {forecast.quality_score}/100</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreGauge label="Predicted CTR" value={forecast.predicted_ctr?.toFixed(1)} max={8} color="yellow" unit="%" />
            <ScoreGauge label="Conversion Rate" value={forecast.predicted_conversion_rate?.toFixed(1)} max={80} color="green" unit="%" />
            <ScoreGauge label="30-Day Completions" value={Math.round(forecast.predicted_completions_30d)} max={5000} color="blue" />
            <ScoreGauge label="Predicted ROI" value={forecast.predicted_roi?.toFixed(2)} max={3} color="purple" unit="x" />
          </div>

          {/* Radar */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Performance Profile</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendations */}
          {forecast.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Recommendations</p>
              {forecast.recommendations.map((r, i) => (
                <RecommendationBadge key={i} text={r.text} type={r.type || 'tip'} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}