import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, Zap, CheckCircle2, Clock, Shield, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function FraudAlertPanel({ adminUser }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin-fraud-alerts'],
    queryFn: () => base44.entities.Notification.filter({ user_id: adminUser?.id, type: 'referral_earnings' }, '-created_date', 50),
    enabled: !!adminUser,
    refetchInterval: 60000,
  });

  const fraudAlerts = alerts.filter(a => a.title?.startsWith('🚨'));

  const runScan = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('fraudAlertNotifier', {});
      setLastResult(res.data);
      qc.invalidateQueries(['admin-fraud-alerts']);
      if (res.data?.alerts_sent > 0) {
        toast.warning(`${res.data.alerts_sent} suspicious pattern(s) detected! Emails sent to admins.`);
      } else {
        toast.success('Scan complete — no suspicious patterns found.');
      }
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { status: 'read' });
    qc.invalidateQueries(['admin-fraud-alerts']);
  };

  const unreadCount = fraudAlerts.filter(a => a.status === 'unread').length;

  return (
    <div className="space-y-5">
      {/* Header + Trigger */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" /> Fraud Alert System
          </h2>
          <p className="text-sm text-gray-500">Automated detection for click spikes, rapid sign-ups, and suspicious referral patterns</p>
        </div>
        <Button onClick={runScan} disabled={running} className="bg-red-600 hover:bg-red-700 gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? 'Scanning...' : 'Run Scan Now'}
        </Button>
      </div>

      {/* Detection Rules Info */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: '🖱️', title: 'Click Spike', desc: '50+ clicks with 0 conversions on any link' },
          { icon: '⚡', title: 'Rapid Sign-Ups', desc: '5+ referrals from same user within 1 hour' },
          { icon: '📉', title: 'Zero Conversion Intent', desc: '10+ referrals in 24h with no earnings generated' },
        ].map(rule => (
          <Card key={rule.title} className="border border-orange-100 bg-orange-50/40">
            <CardContent className="pt-3 pb-3">
              <p className="text-lg mb-1">{rule.icon}</p>
              <p className="text-xs font-semibold text-gray-800">{rule.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{rule.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Last Scan Result */}
      {lastResult && (
        <Card className={`border-2 ${lastResult.alerts_sent > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            {lastResult.alerts_sent > 0
              ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              : <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
            <div>
              <p className="text-sm font-semibold text-gray-900">{lastResult.message || `${lastResult.alerts_sent} alert(s) detected`}</p>
              {lastResult.high_severity > 0 && <p className="text-xs text-red-600">{lastResult.high_severity} high-severity — admin emails dispatched</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Feed */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-500" /> Alert History
              {unreadCount > 0 && <Badge className="bg-red-600 text-white text-xs">{unreadCount} new</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['admin-fraud-alerts'])} className="gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Loading alerts...</div>
          ) : fraudAlerts.length === 0 ? (
            <div className="py-10 text-center">
              <Shield className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No fraud alerts yet — run a scan to detect suspicious patterns.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fraudAlerts.slice(0, 30).map(alert => (
                <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${alert.status === 'unread' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.status === 'unread' ? 'text-red-500' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${alert.status === 'unread' ? 'text-red-800' : 'text-gray-700'}`}>{alert.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(alert.created_date), { addSuffix: true })}
                    </p>
                  </div>
                  {alert.status === 'unread' && (
                    <Button size="sm" variant="ghost" className="text-xs text-gray-500 flex-shrink-0" onClick={() => markRead(alert.id)}>
                      Dismiss
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