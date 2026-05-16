import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, CheckCircle2, Clock, TrendingUp, User, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const FRAUD_COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#eab308',
  CLEAN: '#10b981'
};

export default function RealtimeFraudMonitorDashboard() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('all'); // all, high-risk, frozen, recent
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') {
        window.location.href = '/';
      }
      setUser(u);
    });
  }, []);

  // Fetch fraud reports and UX session data
  const { data: fraudReports = [] } = useQuery({
    queryKey: ['fraudReports'],
    queryFn: async () => {
      const reports = await base44.asServiceRole.entities.FraudReport.filter(
        { status: 'flagged' },
        '-created_date',
        50
      );
      return reports;
    },
    enabled: !!user?.role === 'admin',
    refetchInterval: 5000 // Real-time: update every 5 seconds
  });

  // Fetch UX sessions with high fraud scores
  const { data: suspiciousSessions = [] } = useQuery({
    queryKey: ['suspiciousSessions'],
    queryFn: async () => {
      const sessions = await base44.asServiceRole.entities.UXSessionRecording.filter(
        { fraud_analysis_status: 'flagged' },
        '-recorded_at',
        30
      );
      return sessions;
    },
    enabled: !!user?.role === 'admin',
    refetchInterval: 5000
  });

  // Fetch frozen accounts
  const { data: frozenAccounts = [] } = useQuery({
    queryKey: ['frozenAccounts'],
    queryFn: async () => {
      const lockouts = await base44.asServiceRole.entities.LockoutSession.filter(
        { status: 'active' },
        '-created_date'
      );
      return lockouts;
    },
    enabled: !!user?.role === 'admin'
  });

  // Mutation to freeze account
  const freezeAccountMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.asServiceRole.entities.LockoutSession.create({
        user_id: userId,
        status: 'active',
        reason: 'fraud_detected',
        requires_dispute: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frozenAccounts'] });
    }
  });

  // Mutation to unfreeze account
  const unfreezeAccountMutation = useMutation({
    mutationFn: async (lockoutId) => {
      await base44.asServiceRole.entities.LockoutSession.update(lockoutId, {
        status: 'resolved'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frozenAccounts'] });
    }
  });

  // Filter logic
  const getFilteredReports = () => {
    switch (filter) {
      case 'high-risk':
        return fraudReports.filter(r => r.fraud_score >= 70);
      case 'frozen':
        return fraudReports.filter(r => frozenAccounts.some(f => f.user_id === r.user_id));
      case 'recent':
        return fraudReports.slice(0, 10);
      default:
        return fraudReports;
    }
  };

  // Calculate fraud distribution
  const fraudDistribution = [
    { name: 'Clean', value: suspiciousSessions.filter(s => s.fraud_score < 30).length, color: FRAUD_COLORS.CLEAN },
    { name: 'Low Risk', value: suspiciousSessions.filter(s => s.fraud_score >= 30 && s.fraud_score < 50).length, color: FRAUD_COLORS.LOW },
    { name: 'Medium Risk', value: suspiciousSessions.filter(s => s.fraud_score >= 50 && s.fraud_score < 70).length, color: FRAUD_COLORS.MEDIUM },
    { name: 'High Risk', value: suspiciousSessions.filter(s => s.fraud_score >= 70).length, color: FRAUD_COLORS.HIGH }
  ];

  const filteredReports = getFilteredReports();

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🚨 Realtime Fraud Monitor</h1>
          <p className="text-slate-600">Monitor suspicious activity, track frozen accounts, and verify disputes</p>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Flagged This Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{fraudReports.length}</p>
              <p className="text-xs text-slate-500 mt-1">Active alerts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Frozen Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">{frozenAccounts.length}</p>
              <p className="text-xs text-slate-500 mt-1">Awaiting dispute review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">High Risk Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {suspiciousSessions.filter(s => s.fraud_score >= 70).length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Require immediate action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Resolution Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {fraudReports.length > 0 
                  ? Math.round((frozenAccounts.length / fraudReports.length) * 100) 
                  : 0}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Cases actioned</p>
            </CardContent>
          </Card>
        </div>

        {/* Fraud Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Fraud Risk Distribution</CardTitle>
            <CardDescription>Breakdown of UX session fraud scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fraudDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fraudDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All Reports ({fraudReports.length})
          </Button>
          <Button
            variant={filter === 'high-risk' ? 'default' : 'outline'}
            onClick={() => setFilter('high-risk')}
          >
            High Risk
          </Button>
          <Button
            variant={filter === 'frozen' ? 'default' : 'outline'}
            onClick={() => setFilter('frozen')}
          >
            Frozen Accounts
          </Button>
          <Button
            variant={filter === 'recent' ? 'default' : 'outline'}
            onClick={() => setFilter('recent')}
          >
            Recent
          </Button>
        </div>

        {/* Fraud Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active Fraud Alerts</CardTitle>
            <CardDescription>Review and action suspicious activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredReports.map((report) => {
                const isFrozen = frozenAccounts.some(f => f.user_id === report.user_id);
                return (
                  <div key={report.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <p className="font-medium text-slate-900">{report.user_id}</p>
                        <Badge
                          variant="outline"
                          className={
                            report.fraud_score >= 70
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : report.fraud_score >= 50
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }
                        >
                          Score: {report.fraud_score}
                        </Badge>
                        {isFrozen && (
                          <Badge className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Frozen
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{report.details}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.created_date).toLocaleString()}
                        </span>
                        <span>Type: {report.report_type}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {!isFrozen && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => freezeAccountMutation.mutate(report.user_id)}
                          disabled={freezeAccountMutation.isPending}
                        >
                          <Lock className="w-3 h-3 mr-1" /> Freeze
                        </Button>
                      )}
                      {isFrozen && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const lockout = frozenAccounts.find(f => f.user_id === report.user_id);
                            unfreezeAccountMutation.mutate(lockout.id);
                          }}
                          disabled={unfreezeAccountMutation.isPending}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Unfreeze
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Frozen Accounts Details */}
        {frozenAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Frozen Accounts Awaiting Review</CardTitle>
              <CardDescription>Users must submit disputes to regain access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {frozenAccounts.map((lockout) => (
                  <div key={lockout.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div>
                      <p className="font-medium text-red-900">{lockout.user_id}</p>
                      <p className="text-sm text-red-700">Frozen: {new Date(lockout.created_date).toLocaleString()}</p>
                      <p className="text-xs text-red-600 mt-1">Reason: {lockout.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/DisputeCenter?user=${lockout.user_id}`}
                    >
                      Review Dispute
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}