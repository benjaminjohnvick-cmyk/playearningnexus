import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Mail, Smartphone, DollarSign, ClipboardList,
  Target, Trophy, Megaphone, Zap, ShoppingBag, Users, Save
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PREFS = {
  // Delivery methods
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  push_enabled: false,
  // Type filters
  referral_updates: true,
  survey_opportunities: true,
  daily_goal_achievements: true,
  achievement_unlocks: true,
  purchase_complete: true,
  wishlist_price_drops: true,
  platform_announcements: true,
  // Critical only
  critical_only_push: false,
};

const TYPE_PREFS = [
  { key: 'referral_updates',        label: 'Referral Bonuses',       desc: 'Earnings from your referrals', icon: Users,       color: 'text-green-600' },
  { key: 'survey_opportunities',    label: 'New Surveys',            desc: 'New earning opportunities',    icon: ClipboardList,color: 'text-blue-600' },
  { key: 'daily_goal_achievements', label: 'Daily Goal Achieved',    desc: 'When you hit your $3 goal',    icon: Target,      color: 'text-teal-600' },
  { key: 'achievement_unlocks',     label: 'Badges & Achievements',  desc: 'Milestones and rewards',       icon: Trophy,      color: 'text-purple-600' },
  { key: 'purchase_complete',       label: 'Purchases',              desc: 'Game and store purchases',      icon: ShoppingBag, color: 'text-orange-600' },
  { key: 'wishlist_price_drops',    label: 'Wishlist Price Drops',   desc: 'Price drops on your wishlist', icon: Zap,         color: 'text-yellow-600' },
  { key: 'platform_announcements',  label: 'Platform Announcements', desc: 'Important updates from GamerGain', icon: Megaphone, color: 'text-red-600' },
];

async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function sendTestPush() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('GamerGain', {
    body: '🔔 Push notifications are now enabled for critical updates!',
    icon: '/favicon.ico',
  });
}

export default function NotificationSettings() {
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');

  useEffect(() => {
    setPushSupported('Notification' in window);
    if ('Notification' in window) setPushPermission(Notification.permission);

    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser.notification_preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...currentUser.notification_preferences });
        }
      } catch {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const update = (key, value) => setPrefs(p => ({ ...p, [key]: value }));

  const handlePushToggle = async (checked) => {
    if (checked) {
      const granted = await requestPushPermission();
      if (!granted) {
        toast.error('Push permission denied. Please enable it in your browser settings.');
        return;
      }
      setPushPermission('granted');
      update('push_enabled', true);
      sendTestPush();
      toast.success('Push notifications enabled!');
    } else {
      update('push_enabled', false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ notification_preferences: prefs });
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Bell className="w-9 h-9 text-red-600" />
            Notification Settings
          </h1>
          <p className="text-gray-500">Choose how and when GamerGain reaches you</p>
        </div>

        <div className="space-y-6">
          {/* ── Delivery Methods ── */}
          <Card className="border-2 border-gray-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-red-600" /> Delivery Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: 'in_app_enabled',  icon: Bell,       label: 'In-App',      desc: 'Bell icon & notification center' },
                { key: 'email_enabled',   icon: Mail,       label: 'Email',       desc: 'Sent to your account email' },
                { key: 'sms_enabled',     icon: Smartphone, label: 'SMS',         desc: 'Text messages to your phone' },
              ].map(({ key, icon: Icon, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <Icon className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <Label className="font-semibold">{label}</Label>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                  <Switch checked={prefs[key]} onCheckedChange={v => update(key, v)} />
                </div>
              ))}

              {/* Push notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <Zap className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Push Notifications</Label>
                      {!pushSupported && <Badge variant="outline" className="text-xs">Not supported</Badge>}
                      {pushSupported && pushPermission === 'denied' && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">Blocked in browser</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Browser alerts even when the app is in background</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.push_enabled}
                  disabled={!pushSupported || pushPermission === 'denied'}
                  onCheckedChange={handlePushToggle}
                />
              </div>

              {/* Critical-only mode */}
              {prefs.push_enabled && (
                <div className="ml-12 flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <div>
                    <Label className="font-medium text-orange-800 text-sm">Critical updates only</Label>
                    <p className="text-xs text-orange-600">Only push for referral bonuses & goal achievements</p>
                  </div>
                  <Switch
                    checked={prefs.critical_only_push}
                    onCheckedChange={v => update('critical_only_push', v)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Notification Type Filters ── */}
          <Card className="border-2 border-gray-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-600" /> What to Notify Me About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {TYPE_PREFS.map(({ key, label, desc, icon: Icon, color }) => {
                  const enabled = prefs[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${enabled ? 'bg-gray-50' : 'opacity-60'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${color}`} />
                        <div>
                          <p className="font-medium text-sm text-gray-900">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                      </div>
                      <Switch checked={enabled} onCheckedChange={v => update(key, v)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick summary */}
          <Card className="border-2 border-red-100 bg-red-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Your current setup</p>
              <div className="flex flex-wrap gap-2">
                {prefs.in_app_enabled && <Badge className="bg-white text-gray-700 border border-gray-200">In-App</Badge>}
                {prefs.email_enabled && <Badge className="bg-white text-gray-700 border border-gray-200">Email</Badge>}
                {prefs.sms_enabled && <Badge className="bg-white text-gray-700 border border-gray-200">SMS</Badge>}
                {prefs.push_enabled && <Badge className="bg-white text-gray-700 border border-gray-200">Push{prefs.critical_only_push ? ' (Critical)' : ''}</Badge>}
                <span className="text-xs text-red-500 flex items-center">
                  · {TYPE_PREFS.filter(t => prefs[t.key]).length}/{TYPE_PREFS.length} types enabled
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 h-12 text-base gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}