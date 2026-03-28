import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Users, Target, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CHANNEL_COLORS = {
  email: '#6366f1', twitter: '#1da1f2', facebook: '#1877f2',
  instagram: '#e1306c', youtube: '#ff0000', tiktok: '#69c9d0',
  direct: '#10b981', organic: '#f59e0b', linkedin: '#0077b5',
  whatsapp: '#25d366', other: '#6b7280'
};

const CHANNEL_ICONS = {
  email: '📧', twitter: '🐦', facebook: '📘', instagram: '📸',
  youtube: '📺', tiktok: '🎵', direct: '🔗', organic: '🌱',
  linkedin: '💼', whatsapp: '💬', other: '🌐'
};

export default function ChannelROIPanel({ user }) {
  const [tracking, setTracking] = useState(false);

  const { data: journeyEvents = [], refetch } = useQuery({
    queryKey: ['journey_events', user?.id],
    queryFn: () => base44.entities.UserJourneyEvent.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals_roi', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  // Aggregate by channel
  const channelStats = {};
  const CHANNELS = ['email','twitter','facebook','instagram','youtube','tiktok','direct','organic','linkedin','whatsapp','other'];
  CHANNELS.forEach(ch => {
    channelStats[ch] = { channel: ch, clicks: 0, signups: 0, surveys_completed: 0, payouts: 0, revenue: 0, ltv: 0 };
  });

  journeyEvents.forEach(ev => {
    const ch = ev.referral_channel || 'other';
    if (!channelStats[ch]) return;
    if (ev.event_type === 'referral_click') channelStats[ch].clicks++;
    if (ev.event_type === 'signup') channelStats[ch].signups++;
    if (ev.event_type === 'survey_complete') channelStats[ch].surveys_completed++;
    if (ev.event_type === 'payout_completed') {
      channelStats[ch].payouts++;
      channelStats[ch].revenue += ev.amount || 0;
    }
  });

  // Supplement with referral data
  referrals.forEach(r => {
    const ch = r.source_channel || 'direct';
    if (channelStats[ch]) {
      channelStats[ch].revenue += r.commission_earned || 0;
    }
  });

  // Calculate LTV and conversion rates
  const stats = Object.values(channelStats).map(s => ({
    ...s,
    conversion_rate: s.clicks > 0 ? ((s.signups / s.clicks) * 100).toFixed(1) : '0',
    survey_rate: s.signups > 0 ? ((s.surveys_completed / s.signups) * 100).toFixed(1) : '0',
    ltv: s.signups > 0 ? (s.revenue / s.signups).toFixed(2) : '0',
    label: CHANNEL_ICONS[s.channel] + ' ' + s.channel.charAt(0).toUpperCase() + s.channel.slice(1)
  })).filter(s => s.clicks > 0 || s.signups > 0 || s.revenue > 0);

  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);
  const totalSignups = stats.reduce((sum, s) => sum + s.signups, 0);
  const bestChannel = stats.sort((a, b) => b.revenue - a.revenue)[0];

  const trackJourneyEvent = async (eventType, channel) => {
    setTracking(true);
    await base44.entities.UserJourneyEvent.create({
      user_id: user.id,
      referrer_user_id: user.id,
      event_type: eventType,
      referral_channel: channel,
      amount: 0
    });
    toast.success(`Tracked: ${eventType} via ${channel}`);
    refetch();
    setTracking(false);
  };

  const chartData = stats.slice(0, 8).map(s => ({
    name: s.channel,
    Revenue: Number(s.revenue.toFixed(2)),
    Signups: s.signups,
    LTV: Number(s.ltv)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Channel ROI & Lifetime Value</h3>
        <p className="text-sm text-gray-500">Track every user journey from referral click → survey → payout</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><DollarSign className="w-7 h-7 text-green-500" /><div><p className="text-xl font-bold">${totalRevenue.toFixed(2)}</p><p className="text-xs text-gray-500">Total Revenue</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><Users className="w-7 h-7 text-blue-500" /><div><p className="text-xl font-bold">{totalSignups}</p><p className="text-xs text-gray-500">Attributed Signups</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><Target className="w-7 h-7 text-purple-500" /><div><p className="text-xl font-bold">${totalSignups > 0 ? (totalRevenue / totalSignups).toFixed(2) : '0'}</p><p className="text-xs text-gray-500">Avg LTV / User</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><TrendingUp className="w-7 h-7 text-orange-500" /><div><p className="text-xl font-bold">{bestChannel?.label || '—'}</p><p className="text-xs text-gray-500">Best Channel</p></div></div></CardContent></Card>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Channel</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [n === 'Revenue' ? `$${v}` : v, n]} />
                <Bar dataKey="Revenue" fill="#8b5cf6" radius={[4,4,0,0]} />
                <Bar dataKey="Signups" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Channel Table */}
      {stats.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Full Channel Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.map(s => (
                <div key={s.channel} className="flex items-center gap-3 flex-wrap">
                  <div className="w-28 text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <span>{CHANNEL_ICONS[s.channel]}</span>
                    <span className="capitalize">{s.channel}</span>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                      <span>{s.clicks} clicks → {s.signups} signups</span>
                      <span>{s.conversion_rate}% CVR</span>
                    </div>
                    <Progress value={Number(s.conversion_rate)} className="h-1.5" />
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-sm font-bold text-green-600">${Number(s.revenue).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">LTV ${s.ltv}/user</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium mb-1">No journey data yet</p>
            <p className="text-sm">Journey events are tracked automatically as your referrals sign up, complete surveys, and receive payouts.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}