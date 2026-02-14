import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Globe, CreditCard, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState({
    full_name: '',
    phone: '',
    notifications_enabled: true,
    notification_preferences: {
      contest_results: true,
      new_surveys: true,
      friend_activity: true,
      announcements: true,
      achievements: true,
      events: true
    },
    preferred_language: 'en',
    preferred_currency: 'USD',
    prompt_before_logout: true
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setSettings({
          full_name: currentUser.full_name || '',
          phone: currentUser.phone || '',
          notifications_enabled: currentUser.notifications_enabled ?? true,
          notification_preferences: currentUser.notification_preferences || {
            contest_results: true,
            new_surveys: true,
            friend_activity: true,
            announcements: true,
            achievements: true,
            events: true
          },
          preferred_language: currentUser.preferred_language || 'en',
          preferred_currency: currentUser.preferred_currency || 'USD',
          prompt_before_logout: currentUser.prompt_before_logout ?? true
        });
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      await base44.auth.updateMe(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Settings updated successfully!');
    }
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={settings.full_name}
                  onChange={(e) => setSettings({ ...settings, full_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input value={user.email} disabled className="bg-gray-50" />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label>Phone Number</Label>
                <Input
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </Card>

          {/* Notification Settings */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bell className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-500">Get notified about new featured games</p>
                </div>
                <Switch
                  checked={settings.notifications_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="font-medium text-gray-900">Logout Sharing Prompt</p>
                  <p className="text-sm text-gray-500">Show reminder to share on social media before logging out</p>
                </div>
                <Switch
                  checked={settings.prompt_before_logout}
                  onCheckedChange={(checked) => setSettings({ ...settings, prompt_before_logout: checked })}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold text-gray-900 mb-3">Notification Preferences</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Contest Results</p>
                      <p className="text-xs text-gray-500">Daily contest winners and results</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.contest_results}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, contest_results: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">New Surveys</p>
                      <p className="text-xs text-gray-500">When new surveys become available</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.new_surveys}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, new_surveys: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Friend Activity</p>
                      <p className="text-xs text-gray-500">Updates from friends and connections</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.friend_activity}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, friend_activity: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Announcements</p>
                      <p className="text-xs text-gray-500">Platform updates and news</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.announcements}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, announcements: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Achievements</p>
                      <p className="text-xs text-gray-500">Badges, milestones, and rewards</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.achievements}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, achievements: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Events</p>
                      <p className="text-xs text-gray-500">Special events and tournaments</p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.events}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notification_preferences: { ...settings.notification_preferences, events: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Regional Settings */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Regional Preferences</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Language</Label>
                <select
                  value={settings.preferred_language}
                  onChange={(e) => setSettings({ ...settings, preferred_language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              <div>
                <Label>Currency</Label>
                <select
                  value={settings.preferred_currency}
                  onChange={(e) => setSettings({ ...settings, preferred_currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Account Status</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium">
                  {user.subscription_start_date
                    ? new Date(user.subscription_start_date).toLocaleDateString()
                    : new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User Group</span>
                <span className="font-medium">{user.user_group_id || 'Not assigned'}</span>
              </div>
              {user.referral_code && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Referral Code</span>
                  <span className="font-mono font-medium bg-gray-100 px-2 py-1 rounded">
                    {user.referral_code}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}