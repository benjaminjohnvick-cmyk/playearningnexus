import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, RefreshCw, Bell, CheckCircle, Loader2, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export default function SurveyHealthAlerts({ user }) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['survey-health-alerts', user?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: user.id, status: 'unread' }, '-created_date', 50),
    enabled: !!user?.id,
    refetchInterval: 60000, // poll every minute
  });

  const surveyAlerts = alerts.filter(a =>
    a.icon === 'alert-circle' || a.icon === 'clock' || a.action_url === '/AdvancedInsights'
  );

  const dismissMutation = useMutation({
    mutationFn: (alertId) => base44.entities.Notification.update(alertId, { status: 'read' }),
    onSuccess: () => queryClient.invalidateQueries(['survey-health-alerts']),
  });

  const runScanMutation = useMutation({
    mutationFn: () => base44.functions.invoke('surveyHealthMonitor', {}),
    onSuccess: () => {
      queryClient.invalidateQueries(['survey-health-alerts']);
    },
  });

  const dismissAll = async () => {
    await Promise.all(surveyAlerts.map(a => base44.entities.Notification.update(a.id, { status: 'read' })));
    queryClient.invalidateQueries(['survey-health-alerts']);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-500" />
            Survey Health Alerts
            {surveyAlerts.length > 0 && (
              <Badge className="bg-red-500 text-white text-xs">{surveyAlerts.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {surveyAlerts.length > 0 && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={dismissAll}>
                Dismiss All
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => runScanMutation.mutate()}
              disabled={runScanMutation.isPending}
            >
              {runScanMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Scan Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : surveyAlerts.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-sm text-gray-500">
            <CheckCircle className="w-5 h-5 text-green-400" />
            All surveys healthy — no anomalies detected
          </div>
        ) : (
          <div className="space-y-2">
            {surveyAlerts.map(alert => {
              const isCritical = alert.title?.includes('CRITICAL');
              const isTime = alert.icon === 'clock';
              return (
                <div key={alert.id} className={`rounded-xl p-3 border flex items-start gap-3 ${isCritical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {isTime
                      ? <Clock className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`} />
                      : <TrendingDown className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{alert.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(alert.created_date), 'MMM d, h:mm a')}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    onClick={() => dismissMutation.mutate(alert.id)}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {runScanMutation.data && (
          <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-green-700">
            Scan complete: {runScanMutation.data?.data?.alerts_triggered ?? 0} alerts triggered across {runScanMutation.data?.data?.surveys_scanned ?? 0} surveys
          </div>
        )}
      </CardContent>
    </Card>
  );
}