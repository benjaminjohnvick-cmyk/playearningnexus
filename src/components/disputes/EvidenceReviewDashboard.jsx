import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Shield, Bot, CheckCircle, XCircle, AlertTriangle, Loader2, TrendingUp, Activity, User, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const FRAUD_SCORE_CONFIG = {
  low: { label: 'Low Fraud Risk', color: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', range: [0, 30] },
  medium: { label: 'Medium Risk', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', bar: 'bg-yellow-500', range: [31, 65] },
  high: { label: 'High Fraud Risk', color: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', range: [66, 100] },
};

function getFraudLevel(score) {
  if (score <= 30) return 'low';
  if (score <= 65) return 'medium';
  return 'high';
}

export default function EvidenceReviewDashboard({ dispute, onResolved, isAdmin = false }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showFullSummary, setShowFullSummary] = useState(false);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('disputeEvidenceReview', { dispute_id: dispute.id });
      setResult(res.data);
      onResolved?.(res.data);
      toast.success('AI evidence review complete');
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
    }
    setRunning(false);
  };

  const fraudLevel = result ? getFraudLevel(result.fraud_confidence_score) : null;
  const cfg = fraudLevel ? FRAUD_SCORE_CONFIG[fraudLevel] : null;

  if (running) {
    return (
      <Card className="border-2 border-indigo-200 bg-indigo-50">
        <CardContent className="p-8 text-center">
          <Bot className="w-14 h-14 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="font-black text-gray-900 mb-2">Deep Evidence Analysis Running</p>
          <div className="space-y-2 text-left max-w-xs mx-auto mt-4">
            {[
              'Cross-referencing transaction logs…',
              'Analyzing social media engagement data…',
              'Scanning payout history for patterns…',
              'Calculating Fraud Confidence Score…',
              'Generating moderator draft summary…',
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500 flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Button onClick={runAnalysis} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 h-11">
        <Shield className="w-4 h-4" /> Run AI Evidence Review + Fraud Score
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fraud Confidence Score */}
      <Card className={`border-2 ${cfg.bg}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${cfg.color}`} />
              <span className="font-black text-gray-900">Fraud Confidence Score</span>
            </div>
            <Badge className={`${cfg.bg} ${cfg.color} border font-bold text-sm px-3`}>
              {result.fraud_confidence_score}/100 — {cfg.label}
            </Badge>
          </div>
          <Progress value={result.fraud_confidence_score} className="h-3 mb-2" />
          <div className="flex justify-between text-xs text-gray-500 mb-3">
            <span>0 — Legitimate</span>
            <span>100 — Fraudulent</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className="text-xs text-gray-500 mb-1">Legitimacy Score</p>
              <p className={`text-2xl font-black ${result.legitimacy_score >= 70 ? 'text-green-600' : result.legitimacy_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                {result.legitimacy_score}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className="text-xs text-gray-500 mb-1">Verdict Confidence</p>
              <p className="text-2xl font-black text-indigo-600">{result.confidence_in_verdict}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto Verdict */}
      <Card className={`border-2 ${
        result.verdict === 'auto_approve' ? 'border-green-400 bg-green-50' :
        result.verdict === 'auto_deny' ? 'border-red-300 bg-red-50' :
        'border-yellow-300 bg-yellow-50'
      }`}>
        <CardContent className="p-4 flex items-center gap-3">
          {result.verdict === 'auto_approve' && <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />}
          {result.verdict === 'auto_deny' && <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />}
          {result.verdict === 'escalate_human' && <AlertTriangle className="w-8 h-8 text-yellow-600 flex-shrink-0" />}
          <div className="flex-1">
            <p className="font-black text-gray-900">
              {result.verdict === 'auto_approve' ? '✅ Auto-Approved' :
               result.verdict === 'auto_deny' ? '❌ Auto-Denied' :
               '👤 Escalated to Human Moderator'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {result.verdict === 'escalate_human'
                ? result.escalation_reason
                : result.auto_action_taken}
            </p>
          </div>
          {result.estimated_valid_amount > 0 && result.verdict === 'auto_approve' && (
            <div className="bg-green-600 text-white rounded-xl px-4 py-2 text-center">
              <p className="text-xs">Approved</p>
              <p className="font-black text-lg">${result.estimated_valid_amount.toFixed(2)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Cross-Reference */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <p className="text-xs font-bold text-gray-700">Transaction Cross-Reference</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{result.transaction_cross_reference}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <p className="text-xs font-bold text-gray-700">Social Engagement Correlation</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{result.social_engagement_correlation}</p>
          </CardContent>
        </Card>
      </div>

      {/* Evidence points */}
      {result.supporting_evidence?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-700 mb-2">✅ Supporting Evidence</p>
          <ul className="space-y-1">
            {result.supporting_evidence.map((e, i) => (
              <li key={i} className="text-xs text-green-800 flex gap-2"><span className="text-green-500">•</span>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {result.fraud_indicators?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-700 mb-2">⚠️ Fraud Indicators Detected</p>
          <ul className="space-y-1">
            {result.fraud_indicators.map((f, i) => (
              <li key={i} className="text-xs text-red-800 flex gap-2"><span className="text-red-500">•</span>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Moderator Draft Summary — only show to admins or when escalated */}
      {(isAdmin || result.verdict === 'escalate_human') && result.moderator_draft_summary && (
        <Card className="border-2 border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                AI-Generated Moderator Summary
              </div>
              <button onClick={() => setShowFullSummary(s => !s)} className="text-indigo-600">
                {showFullSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardTitle>
          </CardHeader>
          {showFullSummary && (
            <CardContent>
              <div className="bg-indigo-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {result.moderator_draft_summary}
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1">
                    <CheckCircle className="w-3 h-3" /> Approve Claim
                  </Button>
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1">
                    <XCircle className="w-3 h-3" /> Reject Claim
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}