import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, CheckCircle, XCircle, AlertTriangle, Loader2, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AIDisputeReviewer({ dispute, onResolved }) {
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState(null);

  const runReview = async () => {
    setReviewing(true);
    try {
      const response = await base44.functions.invoke('aiDisputeReview', {
        dispute_id: dispute.id,
        user_id: dispute.user_id,
        survey_id: dispute.survey_id,
        response_id: dispute.response_id,
        description: dispute.description,
        screenshot_url: dispute.screenshot_url,
        transaction_id: dispute.transaction_id,
        expected_amount: dispute.expected_amount,
        quality_score_at_time: dispute.quality_score_at_time,
        fraud_reasons_at_time: dispute.fraud_reasons_at_time,
      });
      setResult(response.data);
      onResolved?.(response.data);
    } catch (e) {
      toast.error('Review failed: ' + e.message);
    } finally {
      setReviewing(false);
    }
  };

  const verdict = result?.verdict;
  const confidence = result?.confidence_score;

  return (
    <div className="space-y-3">
      {!result ? (
        <Button
          onClick={runReview}
          disabled={reviewing}
          className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {reviewing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> AI is reviewing evidence...</>
            : <><Bot className="w-4 h-4" /> Run AI Evidence Review</>}
        </Button>
      ) : (
        <Card className={`border-2 ${verdict === 'approved' ? 'border-green-300 bg-green-50' : verdict === 'escalated' ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              {verdict === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {verdict === 'escalated' && <ArrowUpCircle className="w-5 h-5 text-amber-600" />}
              {verdict === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
              <p className="font-bold text-sm capitalize">{
                verdict === 'approved' ? 'Auto-Approved ✓' :
                verdict === 'escalated' ? 'Escalated to Admin' : 'Rejected'
              }</p>
              <Badge className={`ml-auto text-xs ${confidence >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {confidence}% confidence
              </Badge>
            </div>
            <p className="text-xs text-gray-700">{result.reasoning}</p>
            {result.credit_amount > 0 && verdict === 'approved' && (
              <div className="bg-green-100 rounded-lg p-2 text-xs text-green-800 font-semibold">
                💰 ${result.credit_amount.toFixed(2)} credit approved
              </div>
            )}
            {verdict === 'escalated' && (
              <div className="bg-amber-100 rounded-lg p-2 text-xs text-amber-800">
                ⚠️ {result.escalation_reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}