import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Zap, CheckCircle, Clock, RefreshCw } from 'lucide-react';

export default function CompetitorAlertFeed() {
  const [user, setUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch competitor alerts
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['competitorAlerts'],
    queryFn: async () => {
      const data = await base44.entities.CompetitorAlert.filter(
        {},
        '-detected_at',
        100
      );
      return data || [];
    },
    enabled: user?.role === 'admin',
    refetchInterval: 300000 // 5 minutes
  });

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId) => {
      return await base44.entities.CompetitorAlert.update(alertId, {
        status: 'acknowledged',
        acknowledged_by: user.email,
        acknowledged_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitorAlerts'] });
    }
  });

  // Run monitor function
  const monitorMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('competitorAlertMonitor', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitorAlerts'] });
    }
  });

  const filteredAlerts = filterStatus === 'all'
    ? alerts
    : alerts.filter(a => a.status === filterStatus);

  const severityColor = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const statusIcon = {
    new: <AlertTriangle className="w-5 h-5 text-red-600" />,
    acknowledged: <Clock className="w-5 h-5 text-blue-600" />,
    actioned: <CheckCircle className="w-5 h-5 text-green-600" />,
    dismissed: <div className="w-5 h-5 text-slate-400" />
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Competitor Alert Feed</h1>
          <p className="text-slate-600">Real-time monitoring of pricing, features, and market sentiment</p>
        </div>

        {/* Action Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex gap-3 items-center justify-between">
            <div className="flex gap-3">
              <Button
                onClick={() => monitorMutation.mutate()}
                disabled={monitorMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                {monitorMutation.isPending ? 'Monitoring...' : 'Run Immediate Scan'}
              </Button>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              {['all', 'new', 'acknowledged', 'actioned'].map(status => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="ml-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs">
                    {alerts.filter(a => status === 'all' || a.status === status).length}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alert Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600 mb-1">Total Alerts</p>
              <p className="text-3xl font-bold text-slate-900">{alerts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-red-600 mb-1">Critical</p>
              <p className="text-3xl font-bold text-red-900">{alerts.filter(a => a.severity === 'critical').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-orange-600 mb-1">High</p>
              <p className="text-3xl font-bold text-orange-900">{alerts.filter(a => a.severity === 'high').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-green-600 mb-1">Pending Review</p>
              <p className="text-3xl font-bold text-green-900">{alerts.filter(a => a.status === 'new').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Feed */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-12 pb-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
              </CardContent>
            </Card>
          ) : filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No alerts to display</p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => (
              <Card
                key={alert.id}
                className={`border-l-4 ${severityColor[alert.severity]} border-l-[${alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : alert.severity === 'medium' ? 'yellow' : 'blue'}-600]`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      {statusIcon[alert.status]}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-900 text-lg">{alert.alert_title}</h3>
                          <Badge className={`${severityColor[alert.severity]} border`}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.alert_type.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-slate-700 mb-3">{alert.alert_description}</p>

                        {/* Before/After Values */}
                        <div className="grid grid-cols-2 gap-4 mb-3 bg-slate-50 p-3 rounded">
                          <div>
                            <p className="text-xs text-slate-600 font-semibold">Previous</p>
                            <p className="text-sm text-slate-900 font-mono">{alert.previous_value}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 font-semibold">New</p>
                            <p className="text-sm text-slate-900 font-mono">{alert.new_value}</p>
                          </div>
                        </div>

                        {/* AI Analysis */}
                        <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-xs text-purple-600 font-semibold mb-1">AI Impact Assessment</p>
                          <p className="text-sm text-purple-900">{alert.ai_impact_analysis}</p>
                        </div>

                        {/* Recommendation */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-600 font-semibold mb-1">Recommended Action</p>
                          <p className="text-sm text-blue-900">{alert.recommended_action}</p>
                        </div>
                      </div>
                    </div>

                    {/* Competitor Badge */}
                    <div className="text-right ml-4">
                      <p className="font-bold text-slate-900">{alert.competitor_name}</p>
                      <p className="text-xs text-slate-600 mt-2">
                        {new Date(alert.detected_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {alert.status === 'new' && (
                    <div className="flex gap-2 pt-4 border-t border-slate-200">
                      <Button
                        size="sm"
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        disabled={acknowledgeMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Mark Acknowledged
                      </Button>
                      <Button size="sm" variant="outline">
                        Create Task
                      </Button>
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