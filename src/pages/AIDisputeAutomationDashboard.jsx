import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Zap, TrendingUp } from 'lucide-react';

export default function AIDisputeAutomationDashboard() {
  const [user, setUser] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch pending disputes
  const { data: pendingClaims = [], isLoading } = useQuery({
    queryKey: ['pendingDisputes'],
    queryFn: async () => {
      const claims = await base44.asServiceRole?.entities?.DisputeClaim?.filter(
        { status: 'pending' },
        '-created_date',
        50
      );
      return claims || [];
    },
    enabled: user?.role === 'admin',
    refetchInterval: 30000 // Refresh every 30s
  });

  // Analyze claim evidence
  const analyzeClaimMutation = useMutation({
    mutationFn: async (claimId) => {
      const response = await base44.functions.invoke('aiDisputeEvidenceAnalyzer', {
        claim_id: claimId
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSelectedClaim(data);
    }
  });

  // Approve resolution
  const approveMutation = useMutation({
    mutationFn: async ({ claimId, resolution, amount }) => {
      await base44.asServiceRole?.entities?.DisputeClaim?.update(claimId, {
        status: resolution === 'payout' ? 'approved' : 'rejected',
        resolved_amount: amount,
        resolved_by: user.email,
        resolved_date: new Date().toISOString()
      });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingDisputes'] });
      setSelectedClaim(null);
    }
  });

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">AI Dispute Resolution</h1>
          <p className="text-slate-600">Automated evidence analysis with human-in-the-loop approval</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-900">{pendingClaims.length}</div>
              <p className="text-sm text-slate-600 mt-1">Pending Claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">~75%</div>
              <p className="text-sm text-slate-600 mt-1">Auto-Approved Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-900">4h avg</div>
              <p className="text-sm text-slate-600 mt-1">Resolution Time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">92%</div>
              <p className="text-sm text-slate-600 mt-1">AI Confidence Avg</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Claims List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Claims Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : pendingClaims.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending claims</p>
                ) : (
                  pendingClaims.map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => analyzeClaimMutation.mutate(claim.id)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition ${
                        selectedClaim?.claim_id === claim.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-sm text-slate-900">{claim.claim_type}</div>
                      <p className="text-xs text-slate-600 mt-1">{claim.user_id}</p>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(claim.created_date).toLocaleDateString()}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Analysis Results */}
          <div className="lg:col-span-2">
            {analyzeClaimMutation.isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
                    <span className="ml-3 text-slate-600">Analyzing evidence...</span>
                  </div>
                </CardContent>
              </Card>
            ) : selectedClaim ? (
              <>
                {/* AI Recommendation */}
                <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>AI Recommendation</span>
                      <Badge className={selectedClaim.analysis?.RESOLUTION === 'payout' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                        {selectedClaim.analysis?.RESOLUTION?.toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Confidence Score</p>
                      <div className="mt-2 bg-white rounded-lg p-3 flex items-center justify-between">
                        <div className="w-full bg-slate-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full"
                            style={{ width: `${selectedClaim.analysis?.CONFIDENCE || 0}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-900">{selectedClaim.analysis?.CONFIDENCE}%</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">Reasoning</p>
                      <p className="mt-2 text-sm text-slate-700 bg-white p-3 rounded-lg">
                        {selectedClaim.analysis?.REASONING}
                      </p>
                    </div>

                    {selectedClaim.analysis?.RISK_FACTORS?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Risk Factors</p>
                        <div className="mt-2 space-y-2">
                          {selectedClaim.analysis.RISK_FACTORS.map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg">
                              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-slate-700">{factor}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedClaim.analysis?.RECOMMENDED_AMOUNT > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-emerald-900">Recommended Payout</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">
                          ${selectedClaim.analysis.RECOMMENDED_AMOUNT.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* User History */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>User Dispute History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-600">Total Claims</p>
                        <p className="text-xl font-bold text-slate-900">{selectedClaim.user_history?.total_claims}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-600">Approval Rate</p>
                        <p className="text-xl font-bold text-slate-900">{selectedClaim.user_history?.approval_rate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      approveMutation.mutate({
                        claimId: selectedClaim.claim_id,
                        resolution: 'payout',
                        amount: selectedClaim.analysis?.RECOMMENDED_AMOUNT || 0
                      })
                    }
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve Payout
                  </Button>
                  <Button
                    onClick={() =>
                      approveMutation.mutate({
                        claimId: selectedClaim.claim_id,
                        resolution: 'rejection',
                        amount: 0
                      })
                    }
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Claim
                  </Button>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Select a claim to analyze</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}