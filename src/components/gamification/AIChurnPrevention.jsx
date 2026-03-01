import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Gift, Loader2, CheckCircle2, Flame, Bell } from 'lucide-react';

const riskColors = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const riskBg = {
  low: 'from-green-50 to-emerald-50 border-green-200',
  medium: 'from-yellow-50 to-amber-50 border-yellow-200',
  high: 'from-orange-50 to-red-50 border-orange-200',
  critical: 'from-red-50 to-pink-50 border-red-200',
};

export default function AIChurnPrevention({ user }) {
  const [result, setResult] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiRewardsEngine', { action: 'churn_prediction', user_id: user.id }),
    onSuccess: (res) => setResult(res.data?.data || null),
  });

  // Auto-run on mount for seamless UX
  useEffect(() => {
    if (user?.id) mutation.mutate();
  }, [user?.id]);

  const data = result;

  // Don't render anything for low-risk users
  if (data?.risk_level === 'low') return null;

  if (mutation.isPending || !data) {
    return null; // silent load
  }

  return (
    <Card className={`border-2 bg-gradient-to-br ${riskBg[data.risk_level] || riskBg.medium}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {data.risk_level === 'critical' || data.risk_level === 'high'
            ? <AlertTriangle className="w-4 h-4 text-orange-500" />
            : <Flame className="w-4 h-4 text-yellow-500" />
          }
          <span className={data.risk_level === 'critical' ? 'text-red-700' : 'text-orange-700'}>
            {data.risk_level === 'critical' ? 'We miss you!' : data.risk_level === 'high' ? "Don't break your streak!" : 'Keep your momentum!'}
          </span>
          <Badge className={`ml-auto text-xs ${riskColors[data.risk_level]}`}>
            {data.risk_level?.toUpperCase()} RISK
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.action_message && (
          <p className="text-xs text-gray-600">{data.action_message}</p>
        )}

        {data.reward_offer && !claimed && (
          <div className="bg-white rounded-xl border-2 border-dashed border-orange-300 p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-800">Exclusive Offer Just for You</p>
              <p className="text-sm font-semibold text-orange-700 mt-0.5">{data.reward_offer}</p>
              {data.offer_value && (
                <p className="text-xs text-gray-400 mt-0.5">{data.offer_value}</p>
              )}
            </div>
          </div>
        )}

        {claimed && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">Offer claimed! Check your rewards dashboard.</p>
          </div>
        )}

        {data.churn_signals?.length > 0 && (
          <div className="text-xs text-gray-500 space-y-0.5">
            {data.churn_signals.slice(0, 2).map((s, i) => (
              <p key={i} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {s}
              </p>
            ))}
          </div>
        )}

        {!claimed && data.reward_offer && (
          <Button
            size="sm"
            className="w-full bg-orange-500 hover:bg-orange-600 gap-2 text-xs"
            onClick={() => setClaimed(true)}
          >
            <Gift className="w-3.5 h-3.5" />
            Claim My Offer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}