import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';

export default function DisputeClaimsUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);
  const [expandedClaimId, setExpandedClaimId] = useState(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['userDisputeClaims', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await base44.entities.DisputeClaim.filter({ user_id: user.id });
      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });

  const getStatusColor = (status) => {
    const statusMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      resolved: 'bg-emerald-100 text-emerald-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      appealed: 'bg-orange-100 text-orange-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'approved' || status === 'resolved') return <CheckCircle2 className="w-4 h-4" />;
    if (status === 'pending' || status === 'under_review') return <Clock className="w-4 h-4" />;
    if (status === 'rejected') return <AlertCircle className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">My Dispute Claims</h1>
          <p className="text-slate-600">Track and manage your submitted claims with AI-powered resolution analysis</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">{claims.length}</div>
              <p className="text-sm text-slate-600 mt-1">Total Claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">
                {claims.filter(c => c.status === 'approved').length}
              </div>
              <p className="text-sm text-slate-600 mt-1">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-yellow-600">
                {claims.filter(c => c.status === 'under_review' || c.status === 'pending').length}
              </div>
              <p className="text-sm text-slate-600 mt-1">Pending Review</p>
            </CardContent>
          </Card>
        </div>

        {/* Claims List */}
        {claims.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No dispute claims yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="hover:shadow-lg transition">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(claim.status)}
                        <CardTitle className="text-lg">{claim.subject || 'Dispute Claim'}</CardTitle>
                        <Badge className={getStatusColor(claim.status)}>
                          {claim.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">Claim ID: {claim.id.slice(0, 8)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedClaimId(expandedClaimId === claim.id ? null : claim.id)}
                    >
                      {expandedClaimId === claim.id ? 'Hide' : 'View'} Details
                    </Button>
                  </div>
                </CardHeader>

                {expandedClaimId === claim.id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {/* Resolution Score */}
                    {claim.ai_resolution_score !== undefined && (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-900">AI Resolution Score</span>
                          <div className={`text-3xl font-bold ${getScoreColor(claim.ai_resolution_score)}`}>
                            {claim.ai_resolution_score}%
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              claim.ai_resolution_score >= 80
                                ? 'bg-emerald-500'
                                : claim.ai_resolution_score >= 60
                                ? 'bg-blue-500'
                                : claim.ai_resolution_score >= 40
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${claim.ai_resolution_score}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">
                          {claim.ai_resolution_score >= 80
                            ? 'Strong evidence supports your claim'
                            : claim.ai_resolution_score >= 60
                            ? 'Moderate evidence supports your claim'
                            : claim.ai_resolution_score >= 40
                            ? 'Mixed evidence found'
                            : 'Limited evidence found'}
                        </p>
                      </div>
                    )}

                    {/* Evidence Summary */}
                    {claim.evidence_summary && (
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Evidence Analysis
                        </h4>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                          {claim.evidence_summary}
                        </p>
                      </div>
                    )}

                    {/* AI Recommendation */}
                    {claim.ai_recommendation && (
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> AI Recommendation
                        </h4>
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                          <p className="text-sm text-slate-700">{claim.ai_recommendation}</p>
                          {claim.recommended_payout && (
                            <p className="text-lg font-bold text-emerald-600 mt-2">
                              Recommended Payout: ${claim.recommended_payout.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Final Decision */}
                    {claim.final_decision && (
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">Final Decision</h4>
                        <div className={`p-3 rounded border ${
                          claim.final_decision === 'approved'
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <p className="text-sm font-medium">
                            {claim.final_decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
                          </p>
                          {claim.final_payout !== undefined && (
                            <p className="text-lg font-bold mt-1 text-emerald-600">
                              ${claim.final_payout.toFixed(2)}
                            </p>
                          )}
                          {claim.admin_notes && (
                            <p className="text-xs text-slate-600 mt-2">{claim.admin_notes}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="text-xs text-slate-500 space-y-1 pt-3 border-t">
                      <p>Submitted: {new Date(claim.created_date).toLocaleDateString()}</p>
                      {claim.resolved_date && (
                        <p>Resolved: {new Date(claim.resolved_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}