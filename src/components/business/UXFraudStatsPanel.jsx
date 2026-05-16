import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, ArrowUpCircle, Activity, Loader2 } from 'lucide-react';

export default function UXFraudStatsPanel({ surveyId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['uxFraudStats', surveyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('surveyUXFraudAnalyzer', {
        action: 'stats',
        ...(surveyId ? { survey_id: surveyId } : {})
      });
      return res.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
  );

  const s = data || {};
  const byStatus = s.by_status || {};

  return (
    <Card className="border border-red-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
          <Activity className="w-4 h-4 text-red-500" /> UX Fraud Detection — Live Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat icon={<Activity className="w-4 h-4 text-blue-500" />} label="Total Sessions" value={s.total || 0} color="blue" />
          <Stat icon={<ShieldCheck className="w-4 h-4 text-green-500" />} label="Clean" value={byStatus.clean || 0} color="green" />
          <Stat icon={<AlertTriangle className="w-4 h-4 text-red-500" />} label="Flagged" value={byStatus.flagged || 0} color="red" />
          <Stat icon={<ArrowUpCircle className="w-4 h-4 text-purple-500" />} label="Escalated" value={s.escalated_count || 0} color="purple" />
        </div>

        {/* Avg fraud score */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">Avg Fraud Score</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${(s.avg_fraud_score || 0) >= 70 ? 'bg-red-500' : (s.avg_fraud_score || 0) >= 40 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${s.avg_fraud_score || 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700">{s.avg_fraud_score || 0}/100</span>
        </div>

        {/* Pending */}
        {(byStatus.pending || 0) > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
            ⏳ {byStatus.pending} sessions awaiting analysis (processed every 10 min)
          </p>
        )}

        {/* Recent escalations */}
        {(s.recent_escalations || []).length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Recent Admin Escalations</p>
            <div className="space-y-1.5">
              {s.recent_escalations.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="font-mono text-gray-500">#{(e.id || '').slice(-6).toUpperCase()}</span>
                  <Badge className="bg-red-100 text-red-700 text-xs border-0">Score: {e.fraud_score}</Badge>
                  <span className="text-gray-500 truncate">{(e.signals || []).slice(0, 1).join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`rounded-xl p-2.5 text-center ${colors[color]}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}