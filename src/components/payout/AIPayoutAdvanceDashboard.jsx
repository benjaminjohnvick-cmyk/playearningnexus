import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, Clock, CheckCircle2, AlertCircle, Zap, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function AIPayoutAdvanceDashboard({ user }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiPayoutAdvanceEngine', { action: 'analyze' });
      setAnalysis(res.data?.analysis);
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
    }
    setLoading(false);
  };

  const requestAdvance = async () => {
    setRequesting(true);
    try {
      await base44.functions.invoke('aiPayoutAdvanceEngine', { action: 'request_advance' });
      toast.success(`Cash advance of $${analysis?.advance_amount?.toFixed(2)} requested!`);
      setAnalysis(prev => ({ ...prev, advance_requested: true }));
    } catch (e) {
      toast.error('Request failed: ' + e.message);
    }
    setRequesting(false);
  };

  const trustColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-300';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-300';
    return 'text-red-600 bg-red-50 border-red-300';
  };

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-5 h-5 text-blue-600" />
          AI Payout Intelligence
        </CardTitle>
        <p className="text-xs text-gray-500">Predicts your earnings velocity & offers instant cash advances</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && (
          <Button onClick={runAnalysis} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing...</> : '🤖 Run AI Payout Analysis'}
          </Button>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">AI is analyzing your earning patterns...</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-4">
            {/* Trust Score */}
            <div className={`p-3 rounded-xl border-2 ${trustColor(analysis.trust_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">AI Trust Score</p>
                  <p className="text-3xl font-black">{analysis.trust_score}/100</p>
                </div>
                <div className="text-right">
                  <Badge className={analysis.risk_level === 'low' ? 'bg-green-600' : analysis.risk_level === 'medium' ? 'bg-yellow-600' : 'bg-red-600'}>
                    {analysis.risk_level?.toUpperCase()} RISK
                  </Badge>
                </div>
              </div>
            </div>

            {/* Velocity Forecast */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Earnings Velocity Forecast</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '7 Days', value: analysis.velocity_7d },
                  { label: '14 Days', value: analysis.velocity_14d },
                  { label: '30 Days', value: analysis.velocity_30d },
                ].map(v => (
                  <div key={v.label} className="bg-gray-50 rounded-lg p-2.5 text-center border">
                    <p className="text-xs text-gray-500">{v.label}</p>
                    <p className="text-lg font-bold text-green-700">${(v.value || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">predicted</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimal Payout Windows */}
            {analysis.optimal_windows?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Optimal Payout Windows</p>
                <div className="space-y-2">
                  {analysis.optimal_windows.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-blue-700">{w.date}</p>
                          <p className="text-xs font-bold text-green-700">${(w.predicted_balance || 0).toFixed(2)}</p>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5">{w.reasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retention Tip */}
            {analysis.retention_tip && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs font-bold text-purple-700 mb-1">💡 AI Tip</p>
                <p className="text-xs text-purple-600">{analysis.retention_tip}</p>
              </div>
            )}

            {/* Cash Advance */}
            <div className={`p-4 rounded-xl border-2 ${analysis.qualifies_for_advance ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start gap-3">
                {analysis.qualifies_for_advance
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1">
                  <p className={`text-sm font-bold ${analysis.qualifies_for_advance ? 'text-green-700' : 'text-gray-600'}`}>
                    {analysis.qualifies_for_advance ? `⚡ Instant Cash Advance Available: $${analysis.advance_amount?.toFixed(2)}` : 'Cash Advance Not Available Yet'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{analysis.advance_reasoning}</p>
                  {analysis.qualifies_for_advance && !analysis.advance_requested && (
                    <Button
                      size="sm"
                      className="mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600"
                      onClick={requestAdvance}
                      disabled={requesting}
                    >
                      {requesting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <DollarSign className="w-3 h-3 mr-2" />}
                      Request ${analysis.advance_amount?.toFixed(2)} Advance
                    </Button>
                  )}
                  {analysis.advance_requested && (
                    <p className="text-xs text-green-600 font-bold mt-2">✓ Advance requested — processing shortly</p>
                  )}
                </div>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={runAnalysis}>
              🔄 Refresh Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}