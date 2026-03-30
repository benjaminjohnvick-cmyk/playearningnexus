import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Activity, Ban, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function RiskDashboard() {
  const [selectedFlag, setSelectedFlag] = useState(null);

  const { data: flags = [], isLoading, refetch } = useQuery({
    queryKey: ['riskFlags'],
    queryFn: async () => {
      const res = await base44.entities.ReferralRiskFlag.filter({ status: 'active' });
      return res.sort((a, b) => b.risk_score - a.risk_score);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('flagSuspiciousReferrals', {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Scanned. Found ${data.flags_created} suspicious patterns.`);
      refetch();
    },
  });

  const riskTypeColors = {
    high_velocity_signups: 'bg-red-100 text-red-800 border-red-300',
    same_ip_cluster: 'bg-orange-100 text-orange-800 border-orange-300',
    non_converting_active: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    abnormal_geographic: 'bg-purple-100 text-purple-800 border-purple-300',
    bot_pattern: 'bg-red-100 text-red-800 border-red-300',
    payment_fraud_linked: 'bg-pink-100 text-pink-800 border-pink-300',
  };

  const highRiskCount = flags.filter(f => f.risk_score >= 70).length;
  const autoSuspendedCount = flags.filter(f => f.auto_suspended).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600">Active Flags</p>
            <p className="text-3xl font-bold text-red-600">{flags.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600">High Risk (70+)</p>
            <p className="text-3xl font-bold text-orange-600">{highRiskCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600">Auto Suspended</p>
            <p className="text-3xl font-bold text-red-700">{autoSuspendedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {scanMutation.isPending ? 'Scanning...' : 'Run Scan'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Flags List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Suspicious Referral Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : flags.length === 0 ? (
            <p className="text-gray-500">No active flags</p>
          ) : (
            <div className="space-y-3">
              {flags.map((flag) => (
                <div key={flag.id} className={`border rounded-lg p-4 ${riskTypeColors[flag.risk_type]}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold">{flag.referrer_name}</h4>
                      <p className="text-xs opacity-75">{flag.referrer_email}</p>
                    </div>
                    <Badge className={riskTypeColors[flag.risk_type]}>
                      {flag.risk_score}% risk
                    </Badge>
                  </div>

                  <p className="text-sm font-semibold mb-2">
                    {flag.risk_type.replace(/_/g, ' ').toUpperCase()}
                  </p>

                  <div className="text-xs space-y-1 mb-3 opacity-90">
                    <p>• Flagged Referrals: {flag.flagged_referrals_count}</p>
                    {flag.auto_suspended && (
                      <p className="font-semibold flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        AUTO-SUSPENDED
                      </p>
                    )}
                  </div>

                  {!flag.admin_reviewed && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedFlag(flag)}
                      variant="outline"
                      className="text-xs"
                    >
                      Review & Take Action
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}