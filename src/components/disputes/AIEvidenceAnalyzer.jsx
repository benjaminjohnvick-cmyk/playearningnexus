import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Zap, CheckCircle2, AlertCircle, Loader2, Brain, Sparkles,
  TrendingUp, Flag, Shield
} from 'lucide-react';
import { toast } from 'sonner';

export default function AIEvidenceAnalyzer({ claim, proofUrls, onAnalysisComplete }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const res = await base44.functions.invoke('analyzeClaimEvidence', {
        claim_id: claim.id,
        proof_urls: proofUrls,
        claim_type: claim.claim_type,
        item_name: claim.item_name,
        description: claim.description,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsAnalyzing(false);
      onAnalysisComplete?.(data);
      if (data.auto_approved) {
        toast.success('🎉 Your claim was auto-approved! Credits issued.');
      } else if (data.preliminary_decision === 'approve') {
        toast.success('✓ Looks good! Flagged for quick review.');
      }
    },
    onError: (err) => {
      setIsAnalyzing(false);
      toast.error('Analysis failed. Please try again.');
    },
  });

  // Auto-trigger analysis when proof URLs are ready
  useEffect(() => {
    if (proofUrls && proofUrls.length > 0 && !isAnalyzing && !result) {
      analyzeMutation.mutate();
    }
  }, [proofUrls?.length]);

  if (isAnalyzing || analyzeMutation.isPending) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <Brain className="w-5 h-5 text-indigo-600 animate-pulse" />
        </div>
        <p className="font-bold text-indigo-900">AI Analyzing Evidence...</p>
        <p className="text-xs text-indigo-700 mt-1">Our system is reviewing your screenshots and metadata</p>
      </motion.div>
    );
  }

  if (!result) return null;

  const isAutoApproved = result.auto_approved;
  const isHighConfidence = result.confidence_score >= 80;
  const decisionColors = {
    approve: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle2, bgIcon: 'bg-green-100' },
    review_required: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: AlertCircle, bgIcon: 'bg-blue-100' },
    reject: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: Flag, bgIcon: 'bg-red-100' },
  };

  const colors = decisionColors[result.preliminary_decision] || decisionColors.review_required;
  const Icon = colors.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-2 rounded-2xl p-5 ${colors.bg} ${colors.border}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bgIcon}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`font-bold text-sm ${colors.text}`}>
              {isAutoApproved ? '✅ Auto-Approved' : result.preliminary_decision === 'approve' ? '✓ Recommended for Approval' : result.preliminary_decision === 'reject' ? '⚠️ Likely Rejection' : '🔄 Under Review'}
            </h3>
            <Badge className={`text-xs border ${colors.bgIcon} ${colors.text}`}>
              {result.confidence_score}% confident
            </Badge>
          </div>
          <p className={`text-xs ${colors.text} opacity-75`}>AI-powered instant preliminary assessment</p>
        </div>
      </div>

      {/* Confidence meter */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className={`font-semibold ${colors.text}`}>Analysis Confidence</span>
          <span className={`font-black ${colors.text}`}>{result.confidence_score}%</span>
        </div>
        <div className="h-2.5 bg-white/50 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isAutoApproved ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
              isHighConfidence ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
              'bg-gradient-to-r from-amber-400 to-orange-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${result.confidence_score}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div className={`bg-white/60 rounded-xl p-3 mb-4 text-sm ${colors.text}`}>
        <p className="font-semibold mb-1 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          AI Analysis
        </p>
        <p className="text-xs leading-relaxed">{result.reasoning}</p>
      </div>

      {/* Credit issued (if approved) */}
      {isAutoApproved && result.credit_issued > 0 && (
        <div className="bg-green-100 border border-green-300 rounded-xl p-3 mb-4 text-center">
          <p className="text-xs font-bold text-green-700 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            ${result.credit_issued.toFixed(2)} credited instantly to your balance
          </p>
        </div>
      )}

      {/* Concerns (if any) */}
      {result.concerns && result.concerns.length > 0 && (
        <div className="bg-white/60 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-amber-600" />
            Observations
          </p>
          <div className="space-y-1">
            {result.concerns.map((concern, i) => (
              <p key={i} className="text-xs text-gray-600">• {concern}</p>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      <div className={`bg-white/40 rounded-xl p-3 text-xs ${colors.text} flex items-start gap-2`}>
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          {isAutoApproved && <p><strong>Next Step:</strong> Your claim is approved and credited. Check your balance.</p>}
          {result.preliminary_decision === 'approve' && !isAutoApproved && <p><strong>Next Step:</strong> Our team will review this within 1–2 hours for final approval.</p>}
          {result.preliminary_decision === 'reject' && <p><strong>Next Step:</strong> We recommend submitting additional evidence if you believe this is incorrect.</p>}
        </div>
      </div>
    </motion.div>
  );
}