import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Settings as SettingsIcon,
  Mail,
  Smartphone,
  Lock,
  Check
} from "lucide-react";
import { toast } from "sonner";
import LockoutModeSettings from '../components/premium/LockoutModeSettings';
import LocaleSettings from '../components/locale/LocaleSettings';
import { useQuery } from '@tanstack/react-query';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_enabled: true,
    sms_enabled: false,
    in_app_enabled: true,
    wishlist_price_drops: true,
    referral_updates: true,
    survey_opportunities: true,
    achievement_unlocks: true
  });
  
  // Language preference
  const [language, setLanguage] = useState('en');
  
  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data: membership } = useQuery({
    queryKey: ['premium-membership', user?.id],
    queryFn: () => base44.entities.PremiumMembership.filter({ user_id: user.id }).then(m => m[0]),
    enabled: !!user
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setFullName(currentUser.full_name || '');
        setEmail(currentUser.email || '');
        setNotificationPrefs(currentUser.notification_preferences || notificationPrefs);
        setLanguage(currentUser.preferred_language || 'en');
        setTwoFactorEnabled(currentUser.two_factor_enabled || false);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName
      });
      toast.success('Profile updated successfully');
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        notification_preferences: notificationPrefs
      });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const saveLanguage = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        preferred_language: language
      });
      toast.success('Language preference saved');
    } catch (error) {
      toast.error('Failed to save language');
    } finally {
      setLoading(false);
    }
  };

  const toggleTwoFactor = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        two_factor_enabled: !twoFactorEnabled
      });
      setTwoFactorEnabled(!twoFactorEnabled);
      toast.success(
        !twoFactorEnabled 
          ? 'Two-factor authentication enabled' 
          : 'Two-factor authentication disabled'
      );
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <SettingsIcon className="w-10 h-10 text-blue-600" />
            Settings
          </h1>
          <p className="text-gray-600">Manage your account preferences and security</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="premium">
              <Lock className="w-4 h-4 mr-2" />
              Premium
            </TabsTrigger>
            <TabsTrigger value="language">
              <Globe className="w-4 h-4 mr-2" />
              Language
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={email}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">Account Level</p>
                      <p className="text-sm text-gray-600">Level {user.level || 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">Total Points</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {user.points || 0}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Role</p>
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <p className="text-blue-900 font-medium capitalize">
                        {user.role || 'user'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Delivery Methods</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">In-App Notifications</Label>
                          <p className="text-sm text-gray-500">Receive notifications within the app</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationPrefs.in_app_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, in_app_enabled: checked})
                        }
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
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, email_enabled: checked})
                        }
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
                        checked={notificationPrefs.sms_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, sms_enabled: checked})
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Notification Types</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Wishlist Price Drops</Label>
                        <p className="text-sm text-gray-500">Get notified when items go on sale</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.wishlist_price_drops}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, wishlist_price_drops: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Referral Updates</Label>
                        <p className="text-sm text-gray-500">Updates about your referrals</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.referral_updates}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, referral_updates: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Survey Opportunities</Label>
                        <p className="text-sm text-gray-500">New survey opportunities</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.survey_opportunities}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, survey_opportunities: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Achievement Unlocks</Label>
                        <p className="text-sm text-gray-500">When you unlock badges</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.achievement_unlocks}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, achievement_unlocks: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Premium Daily Reminders</Label>
                        <p className="text-sm text-gray-500">Daily SMS to complete your $3 goal</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.premium_daily_reminders}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, premium_daily_reminders: checked})
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveNotifications}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium">
            {membership ? (
              <LockoutModeSettings user={user} membership={membership} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Premium Membership</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">No premium membership found. Upgrade to access lockout mode.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language">
            <LocaleSettings />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Two-Factor Authentication</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <div>
                        <Label className="text-base font-medium">2FA Status</Label>
                        <p className="text-sm text-gray-500">
                          {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={twoFactorEnabled}
                      onCheckedChange={toggleTwoFactor}
                      disabled={loading}
                    />
                  </div>
                  {twoFactorEnabled && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <Check className="w-4 h-4" />
                        <p className="text-sm font-medium">
                          Your account is protected with two-factor authentication
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!currentPassword || !newPassword}
                      onClick={() => toast.info('Password change feature coming soon')}
                    >
                      Update Password
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Account Information</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Account created: {new Date(user.created_date).toLocaleDateString()}</p>
                    <p>User ID: {user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}