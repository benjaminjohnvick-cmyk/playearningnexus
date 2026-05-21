import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Clock, Filter, Save } from 'lucide-react';

export default function AdminDisputeResolution() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('under_review');
  const [expandedClaimId, setExpandedClaimId] = useState(null);
  const [overrides, setOverrides] = useState({});

  // Fetch claims pending admin review
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['adminDisputeClaims', filterStatus],
    queryFn: async () => {
      const result = await base44.entities.DisputeClaim.filter({ status: filterStatus });
      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    staleTime: 1000 * 60,
  });

  // Mutation to resolve claim
  const resolveMutation = useMutation({
    mutationFn: async ({ claimId, decision, payout, notes }) => {
      await base44.entities.DisputeClaim.update(claimId, {
        status: 'resolved',
        final_decision: decision,
        final_payout: payout,
        admin_notes: notes,
        resolved_date: new Date().toISOString(),
        admin_override: decision !== 'approved' || payout !== overrides[claimId]?.recommended_payout
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDisputeClaims']);
      setExpandedClaimId(null);
      setOverrides({});
    },
  });

  const handleApprove = (claim) => {
    const payout = overrides[claim.id]?.payout || claim.recommended_payout || 0;
    resolveMutation.mutate({
      claimId: claim.id,
      decision: 'approved',
      payout,
      notes: overrides[claim.id]?.notes || ''
    });
  };

  const handleReject = (claim) => {
    resolveMutation.mutate({
      claimId: claim.id,
      decision: 'rejected',
      payout: 0,
      notes: overrides[claim.id]?.notes || 'Insufficient evidence'
    });
  };

  const updateOverride = (claimId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [claimId]: { ...prev[claimId], [field]: value }
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Dispute Resolution Center</h1>
          <p className="text-slate-600">Review AI-analyzed claims and approve/override payout decisions</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {['under_review', 'pending', 'resolved'].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              onClick={() => setFilterStatus(status)}
              className={filterStatus === status ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              <Filter className="w-4 h-4 mr-2" />
              {status.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">{claims.length}</div>
              <p className="text-sm text-slate-600 mt-1">Total Claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">
                {claims.filter(c => (c.ai_resolution_score || 0) >= 80).length}
              </div>
              <p className="text-sm text-slate-600 mt-1">High Confidence (80%+)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">
                ${claims.reduce((sum, c) => sum + (c.recommended_payout || 0), 0).toFixed(0)}
              </div>
              <p className="text-sm text-slate-600 mt-1">Total Recommended</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-orange-600">
                {claims.filter(c => (c.ai_resolution_score || 0) < 60).length}
              </div>
              <p className="text-sm text-slate-600 mt-1">Low Confidence</p>
            </CardContent>
          </Card>
        </div>

        {/* Claims Table */}
        {claims.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No claims in this status</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="hover:shadow-lg transition">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`text-2xl font-bold p-2 rounded ${getScoreColor(claim.ai_resolution_score)}`}>
                          {claim.ai_resolution_score || 0}%
                        </div>
                        <div>
                          <CardTitle className="text-base">{claim.subject || 'Dispute Claim'}</CardTitle>
                          <p className="text-xs text-slate-500">User: {claim.user_id?.slice(0, 8)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">
                        ${claim.recommended_payout?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-slate-500">Recommended</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedClaimId(expandedClaimId === claim.id ? null : claim.id)}
                    >
                      {expandedClaimId === claim.id ? 'Collapse' : 'Review'}
                    </Button>
                  </div>
                </CardHeader>

                {expandedClaimId === claim.id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {/* Evidence & Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">Evidence Summary</h4>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                          {claim.evidence_summary || 'No evidence summary available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">AI Recommendation</h4>
                        <p className="text-sm text-slate-700 bg-blue-50 p-3 rounded border border-blue-200">
                          {claim.ai_recommendation || 'Analysis pending'}
                        </p>
                      </div>
                    </div>

                    {/* Admin Override Section */}
                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg space-y-3">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-purple-600" />
                        Admin Override Options
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-900 mb-2">
                            Override Payout Amount
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={claim.recommended_payout?.toString() || '0.00'}
                            value={overrides[claim.id]?.payout || ''}
                            onChange={(e) => updateOverride(claim.id, 'payout', parseFloat(e.target.value))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-900 mb-2">
                            Admin Notes
                          </label>
                          <Input
                            type="text"
                            placeholder="Reason for override (optional)"
                            value={overrides[claim.id]?.notes || ''}
                            onChange={(e) => updateOverride(claim.id, 'notes', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => handleApprove(claim)}
                        disabled={resolveMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve {overrides[claim.id]?.payout ? `(${overrides[claim.id].payout})` : ''}
                      </Button>
                      <Button
                        onClick={() => handleReject(claim)}
                        disabled={resolveMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
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