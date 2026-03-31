import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Calendar, BarChart2, Sparkles, Loader2, CheckCircle,
  Send, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { toast } from 'sonner';

const METRICS = [
  { key: 'spend', label: 'Total Spend', default: true },
  { key: 'clicks', label: 'Total Clicks', default: true },
  { key: 'conversions', label: 'Conversions', default: true },
  { key: 'roi', label: 'ROI', default: true },
  { key: 'ctr', label: 'CTR %', default: true },
  { key: 'top_ad', label: 'Top Performing Ad', default: false },
  { key: 'bid_trends', label: 'Bid Trends', default: false },
];

function computeMetrics(ads, adBalance) {
  const spend = ads.reduce((s, a) => s + (a.total_spent || 0), 0);
  const clicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);
  const conversions = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0);
  const roi = spend > 0 ? ((conversions * 0.4 - spend) / spend * 100) : 0;
  const ctr = clicks > 0 ? (conversions / clicks * 100) : 0;
  const topAd = ads.reduce((best, a) =>
    (a.surveys_completed || 0) > (best?.surveys_completed || 0) ? a : best, null);
  return { spend, clicks, conversions, roi, ctr, topAd, adBalance };
}

export default function AdReportScheduler({ ads, adBalance, userEmail }) {
  const [freq, setFreq] = useState('weekly');
  const [selectedMetrics, setSelectedMetrics] = useState(
    METRICS.filter(m => m.default).map(m => m.key)
  );
  const [aiInsight, setAiInsight] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [email, setEmail] = useState(userEmail || '');

  const metrics = computeMetrics(ads, adBalance);

  const toggleMetric = (key) => {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const generateAIInsight = async () => {
    if (ads.length === 0) { toast.error('No ad data to analyze'); return; }
    setLoadingAI(true);
    const summary = `Advertiser has ${ads.length} ads. Total spend: $${metrics.spend.toFixed(2)}. Clicks: ${metrics.clicks}. Conversions: ${metrics.conversions}. CTR: ${metrics.ctr.toFixed(1)}%. ROI: ${metrics.roi.toFixed(1)}%. Top ad: ${metrics.topAd?.brand_name || 'N/A'} with ${metrics.topAd?.surveys_completed || 0} completions. Active ads: ${ads.filter(a=>a.status==='active').length}. Paused: ${ads.filter(a=>a.status==='paused').length}.`;
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an advertising performance analyst. Given this campaign data:\n${summary}\n\nWrite a concise 3-bullet executive summary (plain text, no markdown) with:\n1. Key performance finding\n2. What's working\n3. Top actionable recommendation to improve ROI.`,
    });
    setAiInsight(res);
    setLoadingAI(false);
  };

  const sendReport = async () => {
    if (!email) { toast.error('Enter an email address'); return; }
    setSending(true);
    const lines = [];
    lines.push(`📊 GamerGain Advertiser ${freq === 'weekly' ? 'Weekly' : 'Monthly'} Report\n`);
    lines.push(`Period: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n`);
    if (selectedMetrics.includes('spend'))       lines.push(`💰 Total Spend: $${metrics.spend.toFixed(2)}`);
    if (selectedMetrics.includes('clicks'))      lines.push(`🖱 Total Clicks: ${metrics.clicks}`);
    if (selectedMetrics.includes('conversions')) lines.push(`✅ Conversions: ${metrics.conversions}`);
    if (selectedMetrics.includes('roi'))         lines.push(`📈 ROI: ${metrics.roi.toFixed(1)}%`);
    if (selectedMetrics.includes('ctr'))         lines.push(`🎯 CTR: ${metrics.ctr.toFixed(1)}%`);
    if (selectedMetrics.includes('top_ad') && metrics.topAd) {
      lines.push(`⭐ Top Ad: ${metrics.topAd.brand_name} (${metrics.topAd.surveys_completed} completions)`);
    }
    if (aiInsight) lines.push(`\n🤖 AI Insights:\n${aiInsight}`);
    lines.push(`\nManage your campaigns: ${window.location.origin}/AdBusinessDashboard`);

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Your GamerGain ${freq === 'weekly' ? 'Weekly' : 'Monthly'} Ad Report`,
      body: lines.join('\n'),
    });
    toast.success('Report sent to ' + email);
    setSending(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-400" />
        <h3 className="text-white font-bold">Automated Report Builder</h3>
      </div>

      {/* Frequency */}
      <div>
        <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-bold">Report Frequency</p>
        <div className="flex gap-2">
          {['weekly', 'monthly'].map(f => (
            <button key={f} onClick={() => setFreq(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all border ${
                freq === f ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-gray-700 text-gray-500 hover:text-white'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Email */}
      <div>
        <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-bold">Send To</p>
        <Input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-600 text-sm" />
      </div>

      {/* Metric toggles */}
      <div>
        <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-bold">Include Metrics</p>
        <div className="flex flex-wrap gap-2">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => toggleMetric(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                selectedMetrics.includes(m.key)
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'border-gray-700 text-gray-500 hover:text-white'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <div className="bg-gray-800/60 border border-purple-500/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-purple-300 font-bold text-xs flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> AI Report Summary
          </p>
          <Button size="sm" onClick={generateAIInsight} disabled={loadingAI}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 gap-1">
            {loadingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loadingAI ? 'Analyzing...' : 'Generate Insight'}
          </Button>
        </div>
        {aiInsight ? (
          <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-line">{aiInsight}</p>
        ) : (
          <p className="text-gray-600 text-xs">Click "Generate Insight" to get AI-powered analysis of your campaign performance.</p>
        )}
      </div>

      {/* Preview toggle */}
      <button onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
        {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showPreview ? 'Hide' : 'Show'} report preview
      </button>

      {showPreview && (
        <div className="bg-gray-950 border border-gray-700 rounded-xl p-4 font-mono text-xs text-gray-300 space-y-1">
          <p className="text-yellow-400 font-bold">📊 GamerGain {freq === 'weekly' ? 'Weekly' : 'Monthly'} Report</p>
          {selectedMetrics.includes('spend') && <p>💰 Total Spend: ${metrics.spend.toFixed(2)}</p>}
          {selectedMetrics.includes('clicks') && <p>🖱 Total Clicks: {metrics.clicks}</p>}
          {selectedMetrics.includes('conversions') && <p>✅ Conversions: {metrics.conversions}</p>}
          {selectedMetrics.includes('roi') && <p>📈 ROI: {metrics.roi.toFixed(1)}%</p>}
          {selectedMetrics.includes('ctr') && <p>🎯 CTR: {metrics.ctr.toFixed(1)}%</p>}
          {aiInsight && <p className="text-purple-300 pt-2 whitespace-pre-line">🤖 AI: {aiInsight}</p>}
        </div>
      )}

      <Button onClick={sendReport} disabled={sending || !email}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black gap-2 h-10">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? 'Sending...' : `Send ${freq === 'weekly' ? 'Weekly' : 'Monthly'} Report Now`}
      </Button>
    </div>
  );
}