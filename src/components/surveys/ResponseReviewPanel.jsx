import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ResponseReviewPanel({ surveyId }) {
  const [selectedFlag, setSelectedFlag] = useState(null);

  const { data: flaggedResponses = [] } = useQuery({
    queryKey: ['flagged-responses', surveyId],
    queryFn: () => base44.entities.FlaggedResponse.filter({ survey_id: surveyId, status: 'pending' })
  });

  const { mutate: handleAction, isPending } = useMutation({
    mutationFn: async ({ flagId, action }) => {
      await base44.entities.FlaggedResponse.update(flagId, {
        status: action === 'approve' ? 'approved' : 'rejected',
        creator_action: action,
        manual_verification_completed: true
      });
    },
    onSuccess: () => {
      toast.success('Response updated');
      setSelectedFlag(null);
    }
  });

  if (flaggedResponses.length === 0) {
    return (
      <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-700">All responses look good! No suspicious patterns detected.</p>
        </CardContent>
      </Card>
    );
  }

  const severityColor = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  const reasonLabels = {
    too_fast: '⚡ Too Fast',
    too_slow: '🐢 Too Slow',
    inconsistent_answers: '🔀 Inconsistent Answers',
    duplicate_pattern: '🔁 Duplicate Pattern',
    impossible_answers: '❌ Impossible Answers'
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        Flagged Responses ({flaggedResponses.length})
      </h3>

      {flaggedResponses.map(flag => (
        <Card key={flag.id} className="border-l-4 border-l-red-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={severityColor[flag.severity]}>
                    {flag.severity.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {flag.flag_reasons.map(reason => (
                    <Badge key={reason} variant="outline" className="text-xs">
                      {reasonLabels[reason]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {flag.details && (
              <Alert className="bg-gray-50 border-gray-200">
                <AlertDescription className="text-xs text-gray-600">
                  {flag.details.time_taken && (
                    <p>⏱️ Time: {Math.round(flag.details.time_taken / 60)}m {flag.details.time_taken % 60}s (expected ~{Math.round(flag.details.expected_min / 60)}m+)</p>
                  )}
                  {flag.details.all_same_answer && (
                    <p>🔀 Selected same answer ({flag.details.all_same_answer}) for all questions</p>
                  )}
                  {flag.details.previous_response_time_diff && (
                    <p>🔁 Completed again in {Math.round(flag.details.previous_response_time_diff)}s</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction({ flagId: flag.id, action: 'approve' })}
                disabled={isPending}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction({ flagId: flag.id, action: 'auto_reject' })}
                disabled={isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-3 h-3 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}