import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Palette, Bell, AlertTriangle, Save, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SETTINGS = [
  { key: 'maintenance_mode', value: 'false', category: 'maintenance', label: 'Maintenance Mode', description: 'Puts the site in maintenance mode, blocking non-admin access.' },
  { key: 'maintenance_message', value: 'We are currently down for maintenance. Please check back soon.', category: 'maintenance', label: 'Maintenance Message', description: 'Message shown to users during maintenance.' },
  { key: 'site_name', value: 'GamerGain', category: 'branding', label: 'Site Name', description: 'The display name for the platform.' },
  { key: 'primary_color', value: '#dc2626', category: 'branding', label: 'Primary Color (hex)', description: 'Main brand color used across the UI.' },
  { key: 'logo_url', value: '', category: 'branding', label: 'Logo URL', description: 'URL to the site logo image.' },
  { key: 'notify_new_user', value: 'true', category: 'notifications', label: 'Notify on New User', description: 'Send admin notification when a new user registers.' },
  { key: 'notify_withdrawal', value: 'true', category: 'notifications', label: 'Notify on Withdrawal', description: 'Send admin notification when a withdrawal is requested.' },
  { key: 'notify_dispute', value: 'true', category: 'notifications', label: 'Notify on Dispute', description: 'Send admin notification when a dispute is filed.' },
  { key: 'global_notification_banner', value: '', category: 'notifications', label: 'Global Notification Banner', description: 'If set, shows a banner to all users on every page.' },
];

function logAudit(actor, actionType, target, details) {
  base44.entities.AdminAuditLog.create({
    actor_email: actor.email,
    actor_id: actor.id,
    action_type: actionType,
    target,
    details,
    timestamp: new Date().toISOString()
  });
}

export default function AdminGlobalSettings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [localValues, setLocalValues] = useState({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setCurrentUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: settingsRecords = [] } = useQuery({
    queryKey: ['global_settings'],
    queryFn: () => base44.entities.GlobalSettings.list(),
    enabled: !!currentUser,
    onSuccess: (data) => {
      const map = {};
      data.forEach(s => { map[s.key] = s.value; });
      setLocalValues(map);
    }
  });

  // Initialize defaults for any missing keys
  useEffect(() => {
    const map = {};
    DEFAULT_SETTINGS.forEach(s => { map[s.key] = s.value; });
    settingsRecords.forEach(s => { map[s.key] = s.value; });
    setLocalValues(map);
  }, [settingsRecords]);

  const handleSave = async (category) => {
    setSaving(true);
    const categorySettings = DEFAULT_SETTINGS.filter(s => s.category === category);
    for (const def of categorySettings) {
      const existing = settingsRecords.find(r => r.key === def.key);
      const newVal = localValues[def.key] ?? def.value;
      if (existing) {
        await base44.entities.GlobalSettings.update(existing.id, { value: newVal });
      } else {
        await base44.entities.GlobalSettings.create({ key: def.key, value: newVal, category: def.category, label: def.label, description: def.description });
      }
    }
    logAudit(currentUser, category === 'maintenance' ? 'update_global_settings' : category === 'branding' ? 'update_branding' : 'update_notification_prefs', category, `Saved ${category} settings`);
    qc.invalidateQueries({ queryKey: ['global_settings'] });
    toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} settings saved`);
    setSaving(false);
  };

  const getBoolValue = (key) => localValues[key] === 'true';
  const setValue = (key, val) => setLocalValues(prev => ({ ...prev, [key]: String(val) }));

  if (!currentUser) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  const maintenanceOn = getBoolValue('maintenance_mode');

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-10 h-10 text-red-600" />
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Global Settings</h1>
            <p className="text-gray-500">System-wide configuration for the platform</p>
          </div>
        </div>

        {/* Maintenance */}
        <Card className={`border-2 ${maintenanceOn ? 'border-orange-400 bg-orange-50' : 'border-red-200 bg-white'}`}>
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${maintenanceOn ? 'text-orange-600' : 'text-gray-400'}`} />
            <CardTitle className="text-lg">Maintenance Mode</CardTitle>
            {maintenanceOn && <Badge className="bg-orange-500 ml-auto">ACTIVE</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between bg-white border rounded-lg p-4">
              <div>
                <p className="font-semibold text-gray-900">Enable Maintenance Mode</p>
                <p className="text-sm text-gray-500">Blocks non-admin users from accessing the platform</p>
              </div>
              <Switch checked={getBoolValue('maintenance_mode')} onCheckedChange={val => setValue('maintenance_mode', val)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Maintenance Message</label>
              <Input value={localValues['maintenance_message'] || ''} onChange={e => setValue('maintenance_message', e.target.value)} placeholder="Message shown during maintenance..." />
            </div>
            <Button onClick={() => handleSave('maintenance')} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Maintenance Settings
            </Button>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="border-2 border-red-200 bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <Palette className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">Site Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {['site_name', 'primary_color', 'logo_url'].map(key => {
              const def = DEFAULT_SETTINGS.find(s => s.key === key);
              return (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{def.label}</label>
                  <p className="text-xs text-gray-400 mb-1">{def.description}</p>
                  <div className="flex gap-2 items-center">
                    <Input value={localValues[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={def.value || `Enter ${def.label}`} />
                    {key === 'primary_color' && (
                      <input type="color" value={localValues[key] || '#dc2626'}
                        onChange={e => setValue(key, e.target.value)}
                        className="w-10 h-10 border rounded cursor-pointer" />
                    )}
                    {key === 'logo_url' && localValues[key] && (
                      <img src={localValues[key]} alt="logo preview" className="h-10 w-10 object-contain border rounded" onError={e => e.target.style.display='none'} />
                    )}
                  </div>
                </div>
              );
            })}
            <Button onClick={() => handleSave('branding')} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Branding
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-2 border-red-200 bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {['notify_new_user', 'notify_withdrawal', 'notify_dispute'].map(key => {
              const def = DEFAULT_SETTINGS.find(s => s.key === key);
              return (
                <div key={key} className="flex items-center justify-between bg-gray-50 border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{def.label}</p>
                    <p className="text-xs text-gray-500">{def.description}</p>
                  </div>
                  <Switch checked={getBoolValue(key)} onCheckedChange={val => setValue(key, val)} />
                </div>
              );
            })}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Global Notification Banner</label>
              <p className="text-xs text-gray-400 mb-1">Displayed to all users on every page. Leave empty to hide.</p>
              <Input value={localValues['global_notification_banner'] || ''} onChange={e => setValue('global_notification_banner', e.target.value)} placeholder="e.g. New feature launched! Check your dashboard." />
            </div>
            <Button onClick={() => handleSave('notifications')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}