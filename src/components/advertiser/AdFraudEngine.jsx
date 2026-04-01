import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, AlertTriangle, Zap, Eye, Monitor, Clock, TrendingDown, Loader2, RefreshCw, Pause } from 'lucide-react';

const RISK_LEVELS = {
  low: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Low Risk' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Medium Risk' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'High Risk' },
};

function generateFraudSignals(ad) {
  const clickRate = ad.total_clicks || 0;
  const completionRate = ad.surveys_completed || 0;
  const ratio = clickRate > 0 ? completionRate / clickRate : 0;

  const signals = [];

  if (ratio < 0.05 && clickRate > 20) {
    signals.push({ type: 'high', icon: <TrendingDown className="w-3.5 h-3.5" />, message: 'Abnormally low survey completion rate — possible bot clicks', metric: `${(ratio * 100).toFixed(1)}% completion` });
  }
  if (clickRate > 200 && completionRate < 10) {
    signals.push({ type: 'high', icon: <Zap className="w-3.5 h-3.5" />, message: 'Velocity spike detected — click rate exceeds expected organic traffic', metric: `${clickRate} clicks` });
  }
  if (ad.total_spent > 0 && ratio > 0.9) {
    signals.push({ type: 'medium', icon: <Eye className="w-3.5 h-3.5" />, message: 'Suspiciously perfect completion ratio — may indicate coordinated behavior', metric: `${(ratio * 100).toFixed(0)}% rate` });
  }
  if (ad.bid_amount > 0.8) {
    signals.push({ type: 'medium', icon: <Monitor className="w-3.5 h-3.5" />, message: 'High bid attracting incentivized traffic clusters', metric: `$${ad.bid_amount} bid` });
  }
  if (signals.length === 0) {
    signals.push({ type: 'low', icon: <ShieldCheck className="w-3.5 h-3.5" />, message: 'No anomalies detected — traffic patterns appear organic', metric: 'All clear' });
  }
  return signals;
}

function overallRisk(signals) {
  if (signals.some(s => s.type === 'high')) return 'high';
  if (signals.some(s => s.type === 'medium')) return 'medium';
  return 'low';
}

export default function AdFraudEngine({ ads, onRefresh }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [pausedAds, setPausedAds] = useState(new Set());

  const adSignals = ads.map(ad => ({ ad, signals: generateFraudSignals(ad) }));
  const highRiskAds = adSignals.filter(({ signals }) => overallRisk(signals) === 'high');

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const summaries = adSignals.map(({ ad, signals }) =>
        `Ad "${ad.brand_name}": ${signals.map(s => s.message).join('; ')}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a digital ad fraud analyst. Analyze these ad campaign fraud signals and provide a concise report:

${summaries}

Provide:
1. Overall fraud risk score (0-100)
2. Top 3 actionable recommendations to reduce fraud exposure
3. Estimated budget at risk (as percentage)
4. Whether any campaigns should be paused immediately`,
        response_json_schema: {
          type: 'object',
          properties: {
            fraud_score: { type: 'number' },
            budget_at_risk_pct: { type: 'number' },
            should_pause_any: { type: 'boolean' },
            recommendations: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          }
        }
      });
      setAiReport(result);
    } finally {
      setAnalyzing(false);
    }
  };

  const pauseAd = async (ad) => {
    await base44.entities.AdListing.update(ad.id, { status: 'paused' });
    setPausedAds(prev => new Set([...prev, ad.id]));
    onRefresh?.();
  };

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-white">{adSignals.filter(({ signals }) => overallRisk(signals) === 'low').length}</p>
          <p className="text-green-400 text-xs font-bold mt-1">Clean Campaigns</p>
        </div>
        <div className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-yellow-400">{adSignals.filter(({ signals }) => overallRisk(signals) === 'medium').length}</p>
          <p className="text-yellow-400 text-xs font-bold mt-1">Medium Risk</p>
        </div>
        <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-red-400">{highRiskAds.length}</p>
          <p className="text-red-400 text-xs font-bold mt-1">High Risk</p>
        </div>
      </div>

      {/* AI Analysis button */}
      <div className="flex gap-2">
        <Button onClick={runAIAnalysis} disabled={analyzing || ads.length === 0}
          className="bg-red-700 hover:bg-red-600 text-white font-bold gap-2">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          {analyzing ? 'Scanning...' : 'Run AI Fraud Scan'}
        </Button>
        <Button variant="outline" onClick={onRefresh} className="border-gray-600 text-gray-300 gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* AI Report */}
      {aiReport && (
        <div className={`border rounded-2xl p-5 ${aiReport.fraud_score > 60 ? 'bg-red-500/5 border-red-500/30' : aiReport.fraud_score > 30 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-green-500/5 border-green-500/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-black text-sm">AI Fraud Intelligence Report</p>
            <div className="flex gap-2">
              <Badge className={`text-xs font-black ${aiReport.fraud_score > 60 ? 'bg-red-500/20 text-red-400' : aiReport.fraud_score > 30 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                Risk Score: {aiReport.fraud_score}/100
              </Badge>
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                {aiReport.budget_at_risk_pct}% budget at risk
              </Badge>
            </div>
          </div>
          <p className="text-gray-300 text-xs mb-3">{aiReport.summary}</p>
          <div className="space-y-1.5">
            {aiReport.recommendations?.map((rec, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-300">
                <span className="text-yellow-400 font-bold flex-shrink-0">{i + 1}.</span>
                {rec}
              </div>
            ))}
          </div>
          {aiReport.should_pause_any && highRiskAds.length > 0 && (
            <div className="mt-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-red-400 text-xs font-bold">⚠ AI recommends pausing {highRiskAds.length} high-risk campaign(s) immediately.</p>
            </div>
          )}
        </div>
      )}

      {/* Per-ad fraud signals */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Per-Campaign Fraud Signals</p>
        {ads.length === 0 && <p className="text-gray-500 text-sm">No ads to analyze.</p>}
        {adSignals.map(({ ad, signals }) => {
          const risk = overallRisk(signals);
          const style = RISK_LEVELS[risk];
          const isPaused = pausedAds.has(ad.id) || ad.status === 'paused';
          return (
            <div key={ad.id} className={`bg-gray-900 border rounded-2xl p-4 ${style.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-bold text-sm">{ad.brand_name}</p>
                  <p className="text-gray-500 text-xs">{ad.grid_tier} tier · ${ad.bid_amount}/survey</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge className={`${style.bg} ${style.color} text-xs border ${style.border}`}>{style.label}</Badge>
                  {risk === 'high' && !isPaused && (
                    <Button size="sm" onClick={() => pauseAd(ad)}
                      className="bg-red-700 hover:bg-red-600 text-white text-xs gap-1 h-7 px-2">
                      <Pause className="w-3 h-3" /> Pause
                    </Button>
                  )}
                  {isPaused && <Badge className="bg-gray-700 text-gray-400 text-xs">Paused</Badge>}
                </div>
              </div>
              <div className="space-y-1.5">
                {signals.map((s, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${RISK_LEVELS[s.type].bg}`}>
                    <span className={RISK_LEVELS[s.type].color}>{s.icon}</span>
                    <span className="text-gray-300 flex-1">{s.message}</span>
                    <span className={`${RISK_LEVELS[s.type].color} font-bold flex-shrink-0`}>{s.metric}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}