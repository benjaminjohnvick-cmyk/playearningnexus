import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Zap, TrendingUp } from 'lucide-react';

export default function AutomationGuardianDashboard() {
  const [manualCheckLoading, setManualCheckLoading] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const queryClient = useQueryClient();

  // Query for automations to track Guardian's schedule
  const { data: automations = [] } = useQuery({
    queryKey: ['automationGuardianAutomations'],
    queryFn: async () => {
      const all = await base44.entities.AdminAuditLog.filter({ type: 'automation_guardian_health_check' });
      return all.slice(0, 50);
    },
    staleTime: 1000 * 60 * 2,
  });

  // Query for failure logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['automationGuardianAudit'],
    queryFn: async () => {
      const logs = await base44.entities.AdminAuditLog.filter({ 
        category: 'automation_health' 
      });
      return logs.slice(0, 100).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    staleTime: 1000 * 60,
  });

  const handleManualCheck = async () => {
    setManualCheckLoading(true);
    try {
      const result = await base44.functions.invoke('automationGuardianHealer', {});
      setLastCheckTime(new Date());
      console.log('Guardian check result:', result);
      // Refresh audit logs
      setTimeout(() => {
        queryClient.invalidateQueries(['automationGuardianAudit']);
      }, 1000);
    } catch (error) {
      console.error('Manual check failed:', error);
    } finally {
      setManualCheckLoading(false);
    }
  };

  // Calculate health stats
  const totalCheckRuns = auditLogs.length;
  const failuresDetected = auditLogs.filter(log => log.failure_detected).length;
  const recoveryRate = totalCheckRuns > 0 ? ((totalCheckRuns - failuresDetected) / totalCheckRuns * 100).toFixed(1) : 'N/A';
  const criticalFailures = auditLogs.filter(log => log.is_critical).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🛡️ Automation Guardian</h1>
          <p className="text-slate-600">Real-time monitoring and self-healing of backend automations</p>
        </div>

        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Recovery Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{recoveryRate}%</div>
              <p className="text-xs text-slate-500 mt-1">Automated fixes successful</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalCheckRuns}</div>
              <p className="text-xs text-slate-500 mt-1">Health check runs completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Critical Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${criticalFailures > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {criticalFailures}
              </div>
              <p className="text-xs text-slate-500 mt-1">Escalated to admins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Last Check</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono text-slate-600">
                {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Not yet'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Check runs every 5 min</p>
            </CardContent>
          </Card>
        </div>

        {/* Manual Control */}
        <div className="mb-8">
          <Button
            onClick={handleManualCheck}
            disabled={manualCheckLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <Zap className="w-4 h-4 mr-2" />
            {manualCheckLoading ? 'Running Health Check...' : 'Run Manual Health Check'}
          </Button>
        </div>

        {/* Recent Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Guardian Activity (Last 30 Checks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No activity yet. Guardian checks run every 5 minutes.</p>
              ) : (
                auditLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                    <div className="flex items-center gap-3 flex-1">
                      {log.is_critical ? (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      ) : log.recovery_successful ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{log.function_name || log.automation_name}</p>
                        <p className="text-xs text-slate-500">{log.error_message || 'Health check completed'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {log.is_critical && <Badge variant="destructive">Critical</Badge>}
                      {log.recovery_successful && <Badge className="bg-emerald-100 text-emerald-800">Recovered</Badge>}
                      {log.recovery_attempted && !log.recovery_successful && <Badge variant="secondary">Attempted</Badge>}
                      <span className="text-xs text-slate-400 ml-2">
                        {log.created_date ? new Date(log.created_date).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">How Automation Guardian Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>🔍 <strong>Continuous Monitoring:</strong> Checks all backend functions every 5 minutes</p>
            <p>⚡ <strong>Intelligent Recovery:</strong> Attempts automatic fixes for transient errors and known issues</p>
            <p>📊 <strong>Self-Learning:</strong> References past successful fixes to resolve similar failures</p>
            <p>🚨 <strong>Smart Escalation:</strong> Notifies admins only for critical failures requiring human intervention</p>
            <p>📝 <strong>Full Audit Trail:</strong> Logs all detections and recovery attempts for compliance</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}