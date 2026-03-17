import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, Users, DollarSign, ExternalLink, Copy,
  BarChart3, Calendar, Target, Plus, MousePointerClick,
  ArrowUpRight, Zap, Link2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import CustomLinkBuilder from '../components/referral/CustomLinkBuilder';

const SOURCES = ['facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'email', 'direct', 'other'];

function generateCode(userId) {
  return `${userId.slice(0, 6)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function ReferralTracking() {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newLink, setNewLink] = useState({ campaign_name: '', link_type: 'general', referral_source: 'direct' });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referralLinks = [], isLoading } = useQuery({
    queryKey: ['referralLinks', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-tracking', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomReferralLink.create({
      ...data,
      user_id: user.id,
      link_code: generateCode(user.id),
      clicks: 0,
      conversions: 0,
      total_earned: 0,
      is_active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['referralLinks']);
      setShowCreate(false);
      setNewLink({ campaign_name: '', link_type: 'general', referral_source: 'direct' });
      toast.success('Referral link created!');
    },
  });

  const copyLink = (link) => {
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${link.link_code}`);
    toast.success('Link copied!');
  };

  // Aggregate stats
  const totalClicks = referralLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalConversions = referralLinks.reduce((s, l) => s + (l.conversions || 0), 0);
  const totalEarned = referralLinks.reduce((s, l) => s + (l.total_earned || 0), 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';

  // Chart data — clicks/conversions per link
  const chartData = referralLinks.slice(0, 8).map(l => ({
    name: l.campaign_name || l.link_code.slice(0, 8),
    clicks: l.clicks || 0,
    conversions: l.conversions || 0,
    earned: parseFloat((l.total_earned || 0).toFixed(2)),
  }));

  // Referrals over time (by month)
  const referralsByMonth = referrals.reduce((acc, r) => {
    const month = format(new Date(r.created_date), 'MMM yy');
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const timelineData = Object.entries(referralsByMonth).slice(-6).map(([month, count]) => ({ month, signups: count }));

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Referral Tracking</h1>
          <p className="text-gray-500 mt-1">Unique links, performance charts, and sign-up analytics</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Clicks', value: totalClicks, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Sign-Ups', value: totalConversions, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, icon: Target, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-5 pb-4">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        {chartData.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Clicks & Conversions by Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Clicks" />
                    <Bar dataKey="conversions" fill="#22c55e" radius={[3, 3, 0, 0]} name="Sign-ups" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Sign-Ups Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="signups" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Sign-ups" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    No sign-up data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Links Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="w-4 h-4" /> Your Referral Links ({referralLinks.length})
            </CardTitle>
            <CardDescription>Each link has a unique code. Share them to track exactly where sign-ups come from.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : referralLinks.length === 0 ? (
              <div className="text-center py-12">
                <Link2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 mb-1">No referral links yet</p>
                <p className="text-sm text-gray-400">Create your first link to start tracking performance</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referralLinks.map(link => {
                  const rate = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={link.id} className="border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm">{link.campaign_name || 'Unnamed Link'}</h3>
                            <Badge variant="outline" className="text-xs capitalize">{link.link_type}</Badge>
                            {link.referral_source && <Badge variant="outline" className="text-xs capitalize">{link.referral_source}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={`${window.location.origin}/?ref=${link.link_code}`}
                              readOnly
                              className="text-xs bg-gray-50 h-8 w-72 font-mono"
                            />
                            <Button size="sm" variant="outline" className="h-8" onClick={() => copyLink(link)}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(link.created_date), 'MMM d, yyyy')}
                        </p>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Clicks', value: link.clicks || 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: MousePointerClick },
                          { label: 'Sign-Ups', value: link.conversions || 0, color: 'text-green-600', bg: 'bg-green-50', icon: Users },
                          { label: 'Earned', value: `$${(link.total_earned || 0).toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50', icon: DollarSign },
                          { label: 'Conv. Rate', value: `${rate}%`, color: 'text-orange-600', bg: 'bg-orange-50', icon: ArrowUpRight },
                        ].map(s => (
                          <div key={s.label} className={`${s.bg} rounded-lg p-2.5 text-center`}>
                            <s.icon className={`w-3.5 h-3.5 ${s.color} mx-auto mb-1`} />
                            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="pt-5 pb-4">
            <p className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Tips to Maximize Earnings</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <p>• Create separate links per platform to see what converts best</p>
              <p>• Each successful sign-up earns 25% commission on their earnings</p>
              <p>• Share on social media during peak hours for more clicks</p>
              <p>• Contest referrals count toward daily prizes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}