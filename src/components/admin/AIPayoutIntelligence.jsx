import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, ShieldAlert, TrendingUp, Play, Loader2,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  DollarSign, Calendar, User, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const RISK_COLORS = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const RISK_ICONS = {
  low: CheckCircle2,
  medium: Clock,
  high: AlertTriangle,
  critical: XCircle,
};

const REC_COLORS = {
  approve: 'bg-green-100 text-green-800',
  flag_for_review: 'bg-amber-100 text-amber-800',
  block: 'bg-red-100 text-red-800',
};

function FraudResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = result.ai_fraud_analysis || {};
  const RiskIcon = RISK_ICONS[analysis.risk_level] || AlertTriangle;

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${analysis.risk_level === 'critical' ? 'border-red-300' : analysis.risk_level === 'high' ? 'border-orange-300' : 'border-gray-200'}`}>
      <button
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${RISK_COLORS[analysis.risk_level] || 'bg-gray-100 text-gray-500'}`}>
            {Math.round(analysis.risk_score || 0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{result.user_name || 'Unknown'}</p>
            <p className="text-xs text-gray-400 truncate">{result.user_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <span className="text-base font-bold text-gray-800">${(result.amount || 0).toFixed(2)}</span>
          <Badge className={`${RISK_COLORS[analysis.risk_level]} text-xs border`}>
            <RiskIcon className="w-3 h-3 mr-1" />
            {analysis.risk_level || '—'}
          </Badge>
          <Badge className={`${REC_COLORS[analysis.recommendation]} text-xs`}>
            {analysis.recommendation?.replace('_', ' ') || '—'}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 bg-white border-t space-y-3">
          <p className="text-sm text-gray-700"><span className="font-semibold">AI Explanation:</span> {analysis.explanation}</p>
          {(analysis.fraud_signals || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Fraud Signals Detected:</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.fraud_signals.map((signal, i) => (
                  <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">{signal}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
            <span>Payout ID: <code className="bg-gray-100 px-1 rounded">{result.payout_id}</code></span>
            <span>Method: {result.method}</span>
            <span>Status: {result.payout_status}</span>
            <span>Confidence: {Math.round((analysis.confidence || 0) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OptimizationCard({ prediction, onAutoSchedule }) {
  const [expanded, setExpanded] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const rec = prediction.ai_recommendation || {};
  const priority = rec.priority_score || 0;

  const priorityColor = priority >= 8 ? 'text-red-600 bg-red-50' :
    priority >= 5 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${priorityColor}`}>
            {priority}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{prediction.user_name || 'Unknown'}</p>
            <p className="text-xs text-gray-400 truncate">{prediction.user_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <span className="text-base font-bold text-gray-800">${(prediction.pending_earnings || 0).toFixed(2)}</span>
          {rec.should_pay_now && (
            <Badge className="bg-green-100 text-green-700 text-xs">Pay Now</Badge>
          )}
          {rec.optimal_date && (
            <Badge variant="outline" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {rec.optimal_date}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs capitalize">{prediction.pref_method?.replace('_', ' ')}</Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 bg-white border-t space-y-3">
          <p className="text-sm text-gray-700"><span className="font-semibold">AI Recommendation:</span> {rec.reason}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Avg Daily', value: `$${(prediction.avg_daily_earning || 0).toFixed(2)}` },
              { label: 'Days Since Last', value: prediction.days_since_last_payout !== null ? `${prediction.days_since_last_payout}d` : 'Never' },
              { label: 'Optimal In', value: rec.optimal_days_from_now !== undefined ? `${rec.optimal_days_from_now}d` : '—' },
              { label: 'Projected Balance', value: rec.projected_balance ? `$${rec.projected_balance.toFixed(2)}` : '—' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="font-bold text-gray-800 text-sm mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap text-xs text-gray-400">
            <span>Threshold: ${prediction.pref_threshold}</span>
            <span>Frequency: {prediction.pref_frequency}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIPayoutIntelligence() {
  const [fraudResults, setFraudResults] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState(null);

  const fraudMutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiPayoutFraudDetection', {}),
    onSuccess: (res) => {
      setFraudResults(res.data);
      const { flagged, blocked } = res.data;
      if (blocked > 0) {
        toast.error(`${blocked} payout(s) BLOCKED by fraud detection!`);
      } else if (flagged > 0) {
        toast.warning(`${flagged} payout(s) flagged for review`);
      } else {
        toast.success('Fraud scan complete — no issues detected');
      }
    },
    onError: (e) => toast.error('Fraud scan failed: ' + e.message),
  });

  const optimizeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiPayoutOptimizer', {}),
    onSuccess: (res) => {
      setOptimizationResults(res.data);
      toast.success(`AI analyzed ${res.data.predictions?.length || 0} users`);
    },
    onError: (e) => toast.error('Optimization failed: ' + e.message),
  });

  const fraudData = fraudResults?.results || [];
  const blocked = fraudData.filter(r => r.ai_fraud_analysis?.recommendation === 'block');
  const flagged = fraudData.filter(r => r.ai_fraud_analysis?.recommendation === 'flag_for_review');
  const cleared = fraudData.filter(r => r.ai_fraud_analysis?.recommendation === 'approve');

  const predictions = optimizationResults?.predictions || [];
  const payNow = predictions.filter(p => p.ai_recommendation?.should_pay_now);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI Payout Intelligence</h2>
          <p className="text-sm text-gray-600">AI-powered fraud detection and optimal payout timing predictions</p>
        </div>
      </div>

      <Tabs defaultValue="fraud">
        <TabsList className="w-full">
          <TabsTrigger value="fraud" className="flex-1">
            <ShieldAlert className="w-4 h-4 mr-1.5" /> Fraud Detection
          </TabsTrigger>
          <TabsTrigger value="optimizer" className="flex-1">
            <TrendingUp className="w-4 h-4 mr-1.5" /> Payout Optimizer
          </TabsTrigger>
        </TabsList>

        {/* FRAUD DETECTION TAB */}
        <TabsContent value="fraud" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" /> AI Fraud Scanner
                  </CardTitle>
                  <CardDescription>Scans all pending/processing payouts for suspicious patterns using AI</CardDescription>
                </div>
                <Button
                  onClick={() => fraudMutation.mutate()}
                  disabled={fraudMutation.isPending}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                >
                  {fraudMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
                    : <><Zap className="w-4 h-4 mr-2" />Run Fraud Scan</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!fraudResults && !fraudMutation.isPending && (
                <div className="text-center py-12 text-gray-400">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Run a fraud scan to analyze pending payouts</p>
                  <p className="text-xs mt-1">AI will check earning patterns, account age, velocity, and more</p>
                </div>
              )}

              {fraudMutation.isPending && (
                <div className="text-center py-12 text-gray-500">
                  <Brain className="w-10 h-10 mx-auto mb-3 animate-pulse text-purple-500" />
                  <p className="text-sm font-medium">AI is analyzing payout transactions...</p>
                  <p className="text-xs text-gray-400 mt-1">Checking earning velocity, account age, and behavioral patterns</p>
                </div>
              )}

              {fraudResults && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Blocked', count: blocked.length, color: 'text-red-600 bg-red-50 border-red-100', icon: XCircle },
                      { label: 'Flagged', count: flagged.length, color: 'text-amber-600 bg-amber-50 border-amber-100', icon: AlertTriangle },
                      { label: 'Cleared', count: cleared.length, color: 'text-green-600 bg-green-50 border-green-100', icon: CheckCircle2 },
                    ].map(s => (
                      <div key={s.label} className={`p-3 rounded-xl border text-center ${s.color}`}>
                        <s.icon className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-2xl font-bold">{s.count}</p>
                        <p className="text-xs font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {fraudData.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No pending payouts found to analyze</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Show high-risk first */}
                      {[...blocked, ...flagged, ...cleared].map(r => (
                        <FraudResultCard key={r.payout_id} result={r} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPTIMIZER TAB */}
        <TabsContent value="optimizer" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Payout Timing Optimizer
                  </CardTitle>
                  <CardDescription>AI analyzes each user's earning history to predict the optimal payout date and amount</CardDescription>
                </div>
                <Button
                  onClick={() => optimizeMutation.mutate()}
                  disabled={optimizeMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {optimizeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                    : <><Brain className="w-4 h-4 mr-2" />Run AI Analysis</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!optimizationResults && !optimizeMutation.isPending && (
                <div className="text-center py-12 text-gray-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Run the optimizer to get AI payout timing recommendations</p>
                  <p className="text-xs mt-1">Analyzes daily earnings, history, thresholds, and schedules per user</p>
                </div>
              )}

              {optimizeMutation.isPending && (
                <div className="text-center py-12 text-gray-500">
                  <Brain className="w-10 h-10 mx-auto mb-3 animate-pulse text-blue-500" />
                  <p className="text-sm font-medium">AI is analyzing user earning patterns...</p>
                  <p className="text-xs text-gray-400 mt-1">Predicting optimal payout timing for each user</p>
                </div>
              )}

              {optimizationResults && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Users Analyzed', value: predictions.length, color: 'text-blue-600 bg-blue-50' },
                      { label: 'Pay Now', value: payNow.length, color: 'text-green-600 bg-green-50' },
                      { label: 'Total Pending', value: `$${predictions.reduce((s, p) => s + (p.pending_earnings || 0), 0).toFixed(2)}`, color: 'text-purple-600 bg-purple-50' },
                      { label: 'Analyzed At', value: optimizationResults.analyzed_at ? new Date(optimizationResults.analyzed_at).toLocaleTimeString() : '—', color: 'text-gray-600 bg-gray-50' },
                    ].map(s => (
                      <div key={s.label} className={`p-3 rounded-xl text-center ${s.color}`}>
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-xs mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {predictions.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No users with pending earnings found</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Sorted by priority score (10 = pay immediately)</p>
                      {predictions.map((p, i) => (
                        <OptimizationCard key={p.user_id + i} prediction={p} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}