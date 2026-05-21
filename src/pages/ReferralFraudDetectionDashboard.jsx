import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, TrendingDown, CheckCircle, X, RefreshCw } from 'lucide-react';

export default function ReferralFraudDetectionDashboard() {
  const [user, setUser] = useState(null);
  const [filterRisk, setFilterRisk] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Detect anomalies
  const detectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('detectReferralAnomalies', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalyFlags'] });
    }
  });

  // Fetch anomaly flags
  const { data: flags = [], isLoading, refetch } = useQuery({
    queryKey: ['anomalyFlags'],
    queryFn: async () => {
      const data = await base44.entities.ReferralAnomalyFlag.filter(
        {},
        '-flagged_at',
        200
      );
      return data || [];
    },
    enabled: user?.role === 'admin',
    refetchInterval: 600000 // 10 minutes
  });

  // Review flag mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ flagId, decision, notes }) => {
      return await base44.entities.ReferralAnomalyFlag.update(flagId, {
        review_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'escalated',
        reviewed_by: user.email,
        review_notes: notes,
        reviewed_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalyFlags'] });
    }
  });

  const filteredFlags = filterRisk === 'all'
    ? flags
    : flags.filter(f => f.risk_level === filterRisk);

  const riskColors = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const anomalyTypeDescriptions = {
    velocity_spike: 'Abnormally high referral volume in short timeframe',
    suspicious_pattern: 'Traffic pattern differs significantly from typical user behavior',
    geographic_mismatch: 'Geographic inconsistencies in referral traffic',
    device_clustering: 'Multiple referrals from same device/IP',
    behavioral_anomaly: 'User behavior deviates from platform norms',
    ip_pool_detected: 'Possible usage of proxy/VPN or IP pool',
    conversion_rate_outlier: 'Conversion rate significantly above/below average'
  };

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
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Fraud Detection Dashboard</h1>
          <p className="text-slate-600">Anomaly detection for referral traffic patterns</p>
        </div>

        {/* Action Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex gap-3 items-center justify-between">
            <div className="flex gap-3">
              <Button
                onClick={() => detectMutation.mutate()}
                disabled={detectMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                {detectMutation.isPending ? 'Scanning...' : 'Run Anomaly Detection'}
              </Button>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Risk Filter */}
            <div className="flex gap-2">
              {['all', 'critical', 'high', 'medium', 'low'].map(level => (
                <Button
                  key={level}
                  variant={filterRisk === level ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterRisk(level)}
                  className={filterRisk === level && level !== 'all' ? riskColors[level] : ''}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                  <span className="ml-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs">
                    {flags.filter(f => level === 'all' || f.risk_level === level).length}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Summary Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600 mb-1">Total Flagged</p>
              <p className="text-2xl font-bold text-slate-900">{flags.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-red-600 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-900">{flags.filter(f => f.risk_level === 'critical').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-orange-600 mb-1">High</p>
              <p className="text-2xl font-bold text-orange-900">{flags.filter(f => f.risk_level === 'high').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-green-600 mb-1">Approved</p>
              <p className="text-2xl font-bold text-green-900">{flags.filter(f => f.review_status === 'approved').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-blue-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-blue-900">{flags.filter(f => f.review_status === 'pending_review').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Flags List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-12 pb-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
              </CardContent>
            </Card>
          ) : filteredFlags.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No flagged referrals in this category</p>
              </CardContent>
            </Card>
          ) : (
            filteredFlags.map((flag) => (
              <Card key={flag.id} className="border-l-4 border-l-red-600">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg">
                            Risk Score: {flag.risk_score}/100
                          </h3>
                          <p className="text-sm text-slate-700">
                            {flag.anomaly_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <Badge className={`${riskColors[flag.risk_level]} border`}>
                          {flag.risk_level}
                        </Badge>
                      </div>

                      {/* Evidence Summary */}
                      <div className="bg-red-50 border border-red-200 p-3 rounded mb-3">
                        <p className="text-xs text-red-600 font-semibold mb-1">AI Evidence Summary</p>
                        <p className="text-sm text-red-900">{flag.ai_evidence_summary}</p>
                      </div>

                      {/* Anomaly Indicators */}
                      <div className="mb-3">
                        <p className="text-xs text-slate-600 font-semibold mb-2">Red Flags Detected</p>
                        <div className="flex flex-wrap gap-2">
                          {flag.anomaly_indicators?.map((indicator, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Traffic Analysis */}
                      <div className="grid grid-cols-3 gap-4 mb-3 bg-slate-50 p-3 rounded">
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">Last 24h</p>
                          <p className="text-sm font-bold text-slate-900">
                            {flag.traffic_pattern_analysis?.referrals_last_24h || 0} refs
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">Last 7d</p>
                          <p className="text-sm font-bold text-slate-900">
                            {flag.traffic_pattern_analysis?.referrals_last_7d || 0} refs
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">Conversion Rate</p>
                          <p className="text-sm font-bold text-slate-900">
                            {((flag.comparison_metrics?.this_referral_conversion_rate || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Deviation */}
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded mb-3">
                        <p className="text-xs text-yellow-600 font-semibold mb-1">Platform Comparison</p>
                        <p className="text-sm text-yellow-900">
                          Platform avg: {((flag.comparison_metrics?.platform_avg_conversion_rate || 0) * 100).toFixed(1)}% | 
                          This referral: {((flag.comparison_metrics?.this_referral_conversion_rate || 0) * 100).toFixed(1)}% | 
                          Deviation: {(flag.comparison_metrics?.deviation_percent || 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Referral Info */}
                    <div className="ml-4 text-right min-w-[200px]">
                      <p className="text-xs text-slate-600 mb-3">Referral ID</p>
                      <p className="font-mono text-xs text-slate-900 bg-slate-100 p-2 rounded mb-4 break-words">
                        {flag.referral_id}
                      </p>
                      <p className="text-xs text-slate-600 mb-1">Flagged</p>
                      <p className="text-xs font-bold text-slate-900">
                        {new Date(flag.flagged_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {flag.review_status === 'pending_review' && (
                    <div className="flex gap-2 pt-4 border-t border-slate-200">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          const notes = prompt('Add review notes (optional):');
                          reviewMutation.mutate({ flagId: flag.id, decision: 'approve', notes: notes || '' });
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const notes = prompt('Rejection reason:');
                          reviewMutation.mutate({ flagId: flag.id, decision: 'reject', notes: notes || '' });
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const notes = prompt('Escalation notes:');
                          reviewMutation.mutate({ flagId: flag.id, decision: 'escalate', notes: notes || '' });
                        }}
                      >
                        Escalate
                      </Button>
                    </div>
                  )}

                  {flag.review_status === 'approved' && (
                    <div className="pt-4 border-t border-slate-200 flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Approved by {flag.reviewed_by}</span>
                    </div>
                  )}

                  {flag.review_status === 'rejected' && (
                    <div className="pt-4 border-t border-slate-200 text-sm text-red-700 bg-red-50 p-3 rounded">
                      <p className="font-semibold">Rejected</p>
                      <p>{flag.review_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}