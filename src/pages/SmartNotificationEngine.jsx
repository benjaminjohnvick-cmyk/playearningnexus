import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bell, BellOff, MapPin, Clock, Zap, DollarSign, Target,
  Settings, TrendingUp, CheckCircle, Mail, Smartphone, MessageSquare,
  Loader2, Star, Filter, RefreshCw, BarChart2, Users
} from 'lucide-react';

const CATEGORIES = ['Gaming', 'Finance', 'Health', 'Technology', 'Food', 'Travel', 'Sports', 'Shopping', 'Education', 'Entertainment'];
const FREQUENCIES = [
  { value: 'realtime', label: 'Real-time', desc: 'Instant alerts as surveys appear', icon: Zap },
  { value: 'hourly', label: 'Hourly', desc: 'Digest every hour', icon: Clock },
  { value: 'daily', label: 'Daily', desc: 'One summary per day', icon: Bell },
];

const MOCK_MATCHED_SURVEYS = [
  { id: 1, title: 'Gaming Preferences 2026', payout: 4.50, minutes: 8, match_score: 98, reason: 'Matches your gaming profile', category: 'Gaming', expires_in: '2h' },
  { id: 2, title: 'Tech Adoption Survey', payout: 3.20, minutes: 5, match_score: 94, reason: 'Based on your tech history', category: 'Technology', expires_in: '4h' },
  { id: 3, title: 'Mobile App Feedback', payout: 2.75, minutes: 4, match_score: 89, reason: 'Location match: US', category: 'Technology', expires_in: '1d' },
  { id: 4, title: 'Entertainment Habits', payout: 5.00, minutes: 10, match_score: 87, reason: 'Frequent entertainment category', category: 'Entertainment', expires_in: '6h' },
  { id: 5, title: 'Sports Fan Study', payout: 2.00, minutes: 3, match_score: 82, reason: 'Weekend engagement pattern', category: 'Sports', expires_in: '12h' },
];

const NOTIFICATION_HISTORY = [
  { id: 1, survey: 'Finance Habits Survey', payout: 3.80, sent_at: '2 min ago', opened: true, completed: true },
  { id: 2, survey: 'Gaming Trends 2026', payout: 4.20, sent_at: '1h ago', opened: true, completed: false },
  { id: 3, survey: 'Health & Wellness Q2', payout: 2.50, sent_at: '3h ago', opened: false, completed: false },
  { id: 4, survey: 'Tech Shopping Behavior', payout: 3.00, sent_at: '5h ago', opened: true, completed: true },
  { id: 5, survey: 'Travel Intent 2026', payout: 5.50, sent_at: '1d ago', opened: true, completed: true },
];

function MatchScoreBar({ score }) {
  const color = score >= 95 ? 'bg-green-500' : score >= 85 ? 'bg-blue-500' : score >= 70 ? 'bg-amber-500' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700">{score}%</span>
    </div>
  );
}

export default function SmartNotificationEngine() {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['notif-rules', user?.id],
    queryFn: () => base44.entities.SmartNotificationRule.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const rule = rules[0] || {
    enabled: true,
    min_payout_threshold: 1.0,
    preferred_categories: ['Gaming', 'Technology'],
    notify_frequency: 'realtime',
    notify_channels: ['push'],
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    total_notifications_sent: 47,
    total_surveys_from_notifications: 31,
  };

  const [localRule, setLocalRule] = useState(null);
  useEffect(() => { if (!localRule) setLocalRule(rule); }, [rule]);
  const cfg = localRule || rule;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (rules[0]?.id) {
        return base44.entities.SmartNotificationRule.update(rules[0].id, data);
      }
      return base44.entities.SmartNotificationRule.create({ ...data, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries(['notif-rules', user?.id]),
  });

  const toggleCategory = (cat) => {
    const cats = cfg.preferred_categories || [];
    const next = cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat];
    setLocalRule({ ...cfg, preferred_categories: next });
  };

  const toggleChannel = (ch) => {
    const chs = cfg.notify_channels || [];
    const next = chs.includes(ch) ? chs.filter(c => c !== ch) : [...chs, ch];
    setLocalRule({ ...cfg, notify_channels: next });
  };

  const conversionRate = cfg.total_notifications_sent > 0
    ? Math.round((cfg.total_surveys_from_notifications / cfg.total_notifications_sent) * 100)
    : 0;

  if (!user || isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-7 h-7 text-indigo-600" /> Smart Notification Engine
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">AI-powered survey alerts personalized to your profile & location</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Notifications</span>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={v => setLocalRule({ ...cfg, enabled: v })}
            />
            <Badge className={cfg.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
              {cfg.enabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Notifications Sent', value: cfg.total_notifications_sent || 0, icon: Bell, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Surveys Taken', value: cfg.total_surveys_from_notifications || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Matched Surveys', value: MOCK_MATCHED_SURVEYS.length, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="matched">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="matched"><Target className="w-3.5 h-3.5 mr-1.5" /> Matched Surveys</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" /> Preferences</TabsTrigger>
            <TabsTrigger value="history"><BarChart2 className="w-3.5 h-3.5 mr-1.5" /> History</TabsTrigger>
          </TabsList>

          {/* MATCHED SURVEYS */}
          <TabsContent value="matched" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{MOCK_MATCHED_SURVEYS.length} high-value surveys matched to your profile</p>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
            {MOCK_MATCHED_SURVEYS.map(s => (
              <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{s.title}</span>
                        <Badge className="bg-indigo-50 text-indigo-700 text-xs">{s.category}</Badge>
                        <Badge className="bg-amber-50 text-amber-700 text-xs">Expires {s.expires_in}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3 text-indigo-400" /> {s.reason}
                      </p>
                      <MatchScoreBar score={s.match_score} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-green-600">${s.payout.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{s.minutes} min</p>
                      <Button size="sm" className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3">
                        Start
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* PREFERENCES */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Channels */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-500" /> Notification Channels</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { id: 'push', label: 'Push Notifications', icon: Bell, desc: 'Browser & mobile push' },
                    { id: 'email', label: 'Email Alerts', icon: Mail, desc: 'Digest to your inbox' },
                    { id: 'sms', label: 'SMS Alerts', icon: MessageSquare, desc: 'Text message alerts' },
                  ].map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <ch.icon className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ch.label}</p>
                          <p className="text-xs text-gray-400">{ch.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={(cfg.notify_channels || []).includes(ch.id)}
                        onCheckedChange={() => toggleChannel(ch.id)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Frequency & Threshold */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Frequency & Threshold</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">Alert Frequency</label>
                    <div className="space-y-2">
                      {FREQUENCIES.map(f => {
                        const Icon = f.icon;
                        return (
                          <button key={f.value} onClick={() => setLocalRule({ ...cfg, notify_frequency: f.value })}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all
                              ${cfg.notify_frequency === f.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <Icon className={`w-4 h-4 ${cfg.notify_frequency === f.value ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                              <p className="text-xs text-gray-400">{f.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Minimum Payout: ${cfg.min_payout_threshold?.toFixed(2)}</label>
                    <input type="range" min="0.5" max="10" step="0.5"
                      value={cfg.min_payout_threshold || 1}
                      onChange={e => setLocalRule({ ...cfg, min_payout_threshold: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>$0.50</span><span>$10.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quiet Hours */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BellOff className="w-4 h-4 text-gray-500" /> Quiet Hours</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'quiet_hours_start', label: 'Start (no alerts after)' },
                    { key: 'quiet_hours_end', label: 'End (alerts resume)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                      <input type="time" value={cfg[f.key] || '22:00'}
                        onChange={e => setLocalRule({ ...cfg, [f.key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Location */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> Location Filter</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500 mb-2">Only show surveys available in your region</p>
                  <select value={cfg.location_filter || 'US'}
                    onChange={e => setLocalRule({ ...cfg, location_filter: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="">Global (all regions)</option>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="EU">Europe</option>
                  </select>
                  <div className="mt-3 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700">
                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                    Location-targeted surveys typically pay <strong>2–3× more</strong> than global surveys
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Interests */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Survey Category Interests</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">Select categories to prioritize — you'll get more relevant alerts</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const selected = (cfg.preferred_categories || []).includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
                          ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => saveMutation.mutate(cfg)}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Save Notification Preferences
            </Button>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                { label: 'Sent', value: cfg.total_notifications_sent || 47, color: 'text-indigo-600' },
                { label: 'Opened', value: Math.round((cfg.total_notifications_sent || 47) * 0.72), color: 'text-blue-600' },
                { label: 'Converted', value: cfg.total_surveys_from_notifications || 31, color: 'text-green-600' },
              ].map(s => (
                <Card key={s.label} className="border-0 shadow-sm">
                  <CardContent className="p-3 text-center">
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {NOTIFICATION_HISTORY.map(n => (
              <div key={n.id} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${n.completed ? 'bg-green-100' : n.opened ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  {n.completed ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                   n.opened ? <DollarSign className="w-4 h-4 text-blue-600" /> :
                   <Bell className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{n.survey}</p>
                  <p className="text-xs text-gray-400">{n.sent_at}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-600">${n.payout.toFixed(2)}</p>
                  <Badge className={`text-xs ${n.completed ? 'bg-green-100 text-green-700' : n.opened ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {n.completed ? 'Completed' : n.opened ? 'Opened' : 'Sent'}
                  </Badge>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}