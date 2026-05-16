import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DisputeSubmissionForm from '@/components/disputes/DisputeSubmissionForm';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function DisputeResolverCenter() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch {
        base44.auth.redirectToLogin();
      }
    })();
  }, []);

  const { data: disputes = [] } = useQuery({
    queryKey: ['userDisputes', user?.id],
    queryFn: () => base44.entities.SurveyDispute.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  if (!user) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'submitted_for_review':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">🔍 AI Dispute Resolver</h1>
          <p className="text-gray-600">
            Submit evidence for failed payouts or missing credits. Our AI analyzes your claim and provides preliminary recommendations.
          </p>
        </div>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Dispute</TabsTrigger>
            <TabsTrigger value="history">Your Disputes ({disputes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <DisputeSubmissionForm />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {disputes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No disputes submitted yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => {
                  const aiAnalysis = dispute.ai_analysis ? JSON.parse(dispute.ai_analysis) : null;
                  return (
                    <Card key={dispute.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(dispute.status)}
                                <h3 className="font-semibold text-gray-900 capitalize">
                                  {dispute.dispute_type?.replace(/_/g, ' ')}
                                </h3>
                                <Badge variant="outline">{dispute.status?.replace(/_/g, ' ')}</Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-2">{dispute.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">
                                {new Date(dispute.created_date).toLocaleDateString()}
                              </p>
                              {aiAnalysis && (
                                <Badge className="mt-2 bg-purple-100 text-purple-800">
                                  AI Confidence: {aiAnalysis.confidence_score}%
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* AI Analysis */}
                          {aiAnalysis && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-sm space-y-2">
                              <div>
                                <p className="font-medium text-blue-900">AI Recommendation:</p>
                                <p className="text-blue-800 capitalize font-semibold">
                                  {aiAnalysis.recommendation}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-blue-900">Reasoning:</p>
                                <p className="text-blue-800">{aiAnalysis.reasoning}</p>
                              </div>
                            </div>
                          )}

                          {dispute.evidence_file_urls?.length > 0 && (
                            <div className="text-xs text-gray-500">
                              📎 {dispute.evidence_file_urls.length} file(s) attached
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}