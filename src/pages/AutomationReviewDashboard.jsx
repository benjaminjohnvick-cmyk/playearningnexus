import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Edit, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AutomationReviewDashboard() {
  const [selectedReview, setSelectedReview] = useState(null);
  const [modificationMode, setModificationMode] = useState(false);
  const [modifiedData, setModifiedData] = useState({});
  const queryClient = useQueryClient();

  // Fetch pending reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['automationReviews'],
    queryFn: async () => {
      const pending = await base44.entities.AutomationReview.filter({
        status: 'pending'
      }, '-created_date', 100);
      return pending || [];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: (review_id) =>
      base44.functions.invoke('processAutomationReview', {
        review_id,
        decision: 'approved'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationReviews'] });
      setSelectedReview(null);
      toast.success('Automation approved');
    },
    onError: (error) => toast.error(error.message)
  });

  // Rejection mutation
  const rejectMutation = useMutation({
    mutationFn: (review_id) =>
      base44.functions.invoke('processAutomationReview', {
        review_id,
        decision: 'rejected'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationReviews'] });
      setSelectedReview(null);
      toast.success('Automation rejected');
    },
    onError: (error) => toast.error(error.message)
  });

  // Modification mutation
  const modifyMutation = useMutation({
    mutationFn: (review_id) =>
      base44.functions.invoke('processAutomationReview', {
        review_id,
        decision: 'modified',
        modified_data: modifiedData
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationReviews'] });
      setSelectedReview(null);
      setModificationMode(false);
      setModifiedData({});
      toast.success('Changes applied');
    },
    onError: (error) => toast.error(error.message)
  });

  const priorityColors = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const groupedByType = reviews.reduce((acc, review) => {
    if (!acc[review.automation_type]) acc[review.automation_type] = [];
    acc[review.automation_type].push(review);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Automation Review Center</h1>
          <p className="text-slate-600">Approve, reject, or modify AI automation decisions</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-800"></div>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-900 mb-1">All Clear!</h2>
              <p className="text-green-700">No pending automation reviews. All systems running smoothly.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reviews List */}
            <div className="lg:col-span-2">
              <Tabs defaultValue={Object.keys(groupedByType)[0] || 'all'} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  {Object.keys(groupedByType).map(type => (
                    <TabsTrigger key={type} value={type} className="text-xs">
                      {type.split('_').pop()} ({groupedByType[type].length})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedByType).map(([type, items]) => (
                  <TabsContent key={type} value={type} className="space-y-3">
                    {items.map(review => (
                      <Card
                        key={review.id}
                        className={`cursor-pointer transition ${
                          selectedReview?.id === review.id
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedReview(review)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-slate-900 truncate">
                                  {review.automation_name}
                                </h3>
                                <Badge className={priorityColors[review.priority]}>
                                  {review.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">
                                Entity: {review.entity_type} #{review.entity_id.slice(0, 8)}
                              </p>
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                  Confidence: {review.ai_confidence}%
                                </span>
                              </div>
                            </div>
                            {review.auto_applied && (
                              <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                                Auto-Applied
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* Detail View */}
            <div className="lg:col-span-1">
              {selectedReview ? (
                <Card className="sticky top-6 border-2 border-slate-300">
                  <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-lg">{selectedReview.automation_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">
                          AI Recommendation
                        </label>
                        <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-x-auto max-h-40">
                          {JSON.stringify(selectedReview.ai_recommendation, null, 2)}
                        </pre>
                      </div>

                      {modificationMode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-600 uppercase mb-2 block">
                            Edit Values (JSON)
                          </label>
                          <textarea
                            className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                            rows="6"
                            value={JSON.stringify(modifiedData, null, 2)}
                            onChange={(e) => {
                              try {
                                setModifiedData(JSON.parse(e.target.value));
                              } catch (err) {
                                // Invalid JSON, just update as-is for display
                              }
                            }}
                          />
                        </div>
                      )}

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejectMutation.mutate(selectedReview.id)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (modificationMode) {
                              modifyMutation.mutate(selectedReview.id);
                            } else {
                              setModificationMode(true);
                              setModifiedData(selectedReview.ai_recommendation);
                            }
                          }}
                          disabled={modifyMutation.isPending}
                          className="flex-1 bg-amber-600 hover:bg-amber-700"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {modificationMode ? 'Apply' : 'Modify'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(selectedReview.id)}
                          disabled={approveMutation.isPending}
                          className="flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-dashed border-slate-300 flex items-center justify-center min-h-96">
                  <CardContent className="text-center">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Select a review to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}