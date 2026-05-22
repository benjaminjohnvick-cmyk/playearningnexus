import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Brain, Loader2, TrendingUp, AlertTriangle, Zap, DollarSign, RefreshCw, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function AIFinancialSuggestionsButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setReport(null);
    try {
      // Fetch user data in parallel
      const [payouts, mlmNodes, socialPosts, disputes] = await Promise.all([
        base44.entities.Payout.filter({ recipient_user_id: user.id }, '-created_date', 10).catch(() => []),
        base44.entities.MLMNode.filter({ user_id: user.id }).catch(() => []),
        base44.entities.SocialMediaPost.filter({ user_id: user.id }, '-created_date', 30).catch(() => []),
        base44.entities.AffiliateDispute.filter({ affiliate_user_id: user.id }).catch(() => []),
      ]);

      const totalEarnings = user.total_earnings || 0;
      const recentPayouts = payouts.slice(0, 5);
      const avgPayout = recentPayouts.length
        ? recentPayouts.reduce((s, p) => s + (p.net_payout || 0), 0) / recentPayouts.length
        : 0;
      const activeNodes = mlmNodes.length;
      const scheduledPosts = socialPosts.filter(p => p.status === 'scheduled' || p.status === 'draft').length;
      const pendingDisputes = disputes.filter(d => ['submitted', 'analyzing', 'pending_human'].includes(d.status)).length;

      const prompt = `You are a financial advisor AI for GamerGain, a platform where users earn through surveys, referrals, and AI social media ads.

USER DATA:
- Total lifetime earnings: $${totalEarnings.toFixed(2)}
- Average recent payout: $${avgPayout.toFixed(2)}
- Active MLM affiliate nodes: ${activeNodes}
- Scheduled/pending social posts: ${scheduledPosts}
- Trust score: ${user.trust_score || 70}/100
- Pending dispute resolutions: ${pendingDisputes}
- Account tier: ${user.role || 'user'}
- Connected social platforms: ${user.social_platforms_connected?.length || 0}

TASK: Analyze and produce a financial forecast report.

Respond as JSON with this exact schema:
{
  "predicted_30d_income": number,
  "predicted_90d_income": number,
  "earning_velocity": "low" | "medium" | "high",
  "what_if_scenarios": [
    { "action": string, "impact_percent": number, "predicted_extra_monthly": number, "difficulty": "easy" | "medium" | "hard" }
  ],
  "bottlenecks": [
    { "issue": string, "severity": "low" | "medium" | "high", "fix": string }
  ],
  "top_recommendation": string,
  "confidence": number
}

Rules:
- what_if_scenarios: exactly 4 scenarios
- bottlenecks: 2–4 items based on real data (low trust score, pending disputes, few nodes, no posts all count)
- Be specific with numbers
- predicted_30d_income should be realistic based on avgPayout * cadence + node earnings + post earnings`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            predicted_30d_income: { type: 'number' },
            predicted_90d_income: { type: 'number' },
            earning_velocity: { type: 'string' },
            what_if_scenarios: { type: 'array', items: { type: 'object' } },
            bottlenecks: { type: 'array', items: { type: 'object' } },
            top_recommendation: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      });

      setReport(result);
    } catch (e) {
      setReport({ error: 'Analysis failed. Please try again.' });
    }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(true);
    if (!report) analyze();
  };

  const velocityColor = { low: 'text-red-600', medium: 'text-yellow-600', high: 'text-green-600' };
  const velocityBg = { low: 'bg-red-50 border-red-200', medium: 'bg-yellow-50 border-yellow-200', high: 'bg-green-50 border-green-200' };
  const severityColor = { low: 'bg-blue-100 text-blue-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' };

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold gap-2 shadow-lg hover:opacity-90"
      >
        <Brain className="w-4 h-4" />
        AI Financial Suggestions
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Brain className="w-6 h-6 text-violet-600" />
              AI Financial Intelligence Report
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="py-16 text-center">
              <Brain className="w-12 h-12 text-violet-600 mx-auto mb-4 animate-pulse" />
              <p className="font-bold text-gray-900 mb-2">Analyzing your earning data…</p>
              <p className="text-sm text-gray-500">Checking velocity, nodes, posts, and disputes</p>
            </div>
          )}

          {report?.error && (
            <div className="py-8 text-center text-red-500">{report.error}</div>
          )}

          {report && !report.error && !loading && (
            <div className="space-y-5 pt-2">
              {/* 30-Day Forecast */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white text-center">
                  <p className="text-green-200 text-xs font-bold uppercase mb-1">Predicted 30-Day Income</p>
                  <p className="text-4xl font-black">${(report.predicted_30d_income || 0).toFixed(2)}</p>
                  <p className="text-green-200 text-xs mt-1">AI Confidence: {report.confidence}%</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white text-center">
                  <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Predicted 90-Day Income</p>
                  <p className="text-4xl font-black">${(report.predicted_90d_income || 0).toFixed(2)}</p>
                  <p className={`text-xs font-bold mt-1 capitalize ${velocityColor[report.earning_velocity] || 'text-white'}`}>
                    {report.earning_velocity} velocity
                  </p>
                </div>
              </div>

              {/* Earning Velocity Bar */}
              <div className={`rounded-xl p-4 border ${velocityBg[report.earning_velocity] || 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">Earning Velocity</span>
                  <Badge className={`capitalize ${severityColor[report.earning_velocity === 'low' ? 'high' : report.earning_velocity === 'medium' ? 'medium' : 'low']}`}>
                    {report.earning_velocity}
                  </Badge>
                </div>
                <Progress
                  value={report.earning_velocity === 'high' ? 90 : report.earning_velocity === 'medium' ? 55 : 20}
                  className="h-2"
                />
                <p className="text-xs text-gray-600 mt-2">{report.top_recommendation}</p>
              </div>

              {/* What-If Scenarios */}
              <div>
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" /> What-If Scenarios
                </h3>
                <div className="space-y-2">
                  {(report.what_if_scenarios || []).map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-violet-200 transition-colors gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{s.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Difficulty: <span className="capitalize font-medium">{s.difficulty}</span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-green-600 font-black text-sm">+{s.impact_percent}%</p>
                        <p className="text-xs text-gray-500">+${(s.predicted_extra_monthly || 0).toFixed(2)}/mo</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottlenecks */}
              {(report.bottlenecks || []).length > 0 && (
                <div>
                  <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" /> Withdrawal Bottlenecks & Flags
                  </h3>
                  <div className="space-y-2">
                    {report.bottlenecks.map((b, i) => (
                      <div key={i} className={`rounded-xl p-4 border ${b.severity === 'high' ? 'bg-red-50 border-red-200' : b.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={severityColor[b.severity]}>{b.severity} priority</Badge>
                            </div>
                            <p className="text-sm font-bold text-gray-900">{b.issue}</p>
                            <p className="text-xs text-gray-600 mt-1">💡 {b.fix}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={analyze} variant="outline" className="w-full gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh Analysis
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}