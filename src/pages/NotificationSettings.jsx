import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    sms_enabled: false,
    in_app_enabled: true,
    wishlist_price_drops: true,
    referral_updates: true,
    survey_opportunities: true,
    achievement_unlocks: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setPreferences(currentUser.notification_preferences || preferences);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        notification_preferences: preferences
      });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Bell className="w-10 h-10 text-blue-600" />
            Notification Settings
          </h1>
          <p className="text-gray-600">Manage how you receive notifications</p>
        </div>

        <div className="space-y-6">
          {/* Delivery Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label className="text-base font-medium">In-App Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications within the app</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.in_app_enabled}
                  onCheckedChange={(checked) => updatePreference('in_app_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label className="text-base font-medium">SMS Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications via text message</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => updatePreference('sms_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Types */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Wishlist Price Drops</Label>
                  <p className="text-sm text-gray-500">Get notified when items in your wishlist go on sale</p>
                </div>
                <Switch
                  checked={preferences.wishlist_price_drops}
                  onCheckedChange={(checked) => updatePreference('wishlist_price_drops', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Referral Updates</Label>
                  <p className="text-sm text-gray-500">Updates about your referrals and earnings</p>
                </div>
                <Switch
                  checked={preferences.referral_updates}
                  onCheckedChange={(checked) => updatePreference('referral_updates', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Survey Opportunities</Label>
                  <p className="text-sm text-gray-500">New survey opportunities to earn money</p>
                </div>
                <Switch
                  checked={preferences.survey_opportunities}
                  onCheckedChange={(checked) => updatePreference('survey_opportunities', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Achievement Unlocks</Label>
                  <p className="text-sm text-gray-500">Notifications when you unlock badges and achievements</p>
                </div>
                <Switch
                  checked={preferences.achievement_unlocks}
                  onCheckedChange={(checked) => updatePreference('achievement_unlocks', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}