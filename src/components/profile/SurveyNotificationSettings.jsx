import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Mail, Smartphone, CheckCircle2, Target, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

function Toggle({ enabled, onChange }) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors flex-shrink-0 ${enabled ? 'bg-purple-600' : 'bg-gray-300'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
  );
}

export default function SurveyNotificationSettings({ user, onUpdate }) {
  const prefs = user?.notification_preferences || {};
  const [saving, setSaving] = useState(false);

  const update = async (key, value) => {
    setSaving(true);
    try {
      const updatedPrefs = { ...prefs, [key]: value };
      await base44.auth.updateMe({ notification_preferences: updatedPrefs });
      onUpdate({ notification_preferences: updatedPrefs });
      toast.success('Preference saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const profileComplete = user?.respondent_profile?.profile_complete;
  const profileInterests = (user?.respondent_profile?.interests || []).length;
  const profileSkills = (user?.respondent_profile?.verified_skills || []).length;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-5 h-5 text-purple-600" />
          Survey Notification Settings
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto" />}
        </CardTitle>
        <p className="text-xs text-gray-500">Get notified when surveys matching your profile become available.</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Profile match status */}
        <div className={`rounded-xl p-3 border ${profileComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {profileComplete
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />}
              <div>
                <p className={`text-sm font-semibold ${profileComplete ? 'text-green-700' : 'text-amber-700'}`}>
                  {profileComplete ? 'Profile complete — full targeting active' : 'Incomplete profile — limited survey matches'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {profileInterests} interest{profileInterests !== 1 ? 's' : ''} · {profileSkills} skill{profileSkills !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <Link to={createPageUrl('RespondentProfile')}>
              <Button size="sm" variant="outline" className="text-xs flex-shrink-0 h-7">
                Edit Profile <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Notification channels */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notification Channels</p>
          {[
            {
              key: 'survey_opportunities',
              icon: Target,
              label: 'Survey Opportunity Alerts',
              description: 'Get notified when a new survey matches your demographics and interests',
              color: 'text-purple-600',
            },
            {
              key: 'in_app_enabled',
              icon: Bell,
              label: 'In-App Notifications',
              description: 'Show survey alerts inside the platform (notification bell)',
              color: 'text-blue-600',
            },
            {
              key: 'email_enabled',
              icon: Mail,
              label: 'Email Notifications',
              description: `Receive survey invites at ${user?.email || 'your email'}`,
              color: 'text-green-600',
            },
          ].map(({ key, icon: Icon, label, description, color }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 truncate">{description}</p>
                </div>
              </div>
              <Toggle enabled={prefs[key] !== false} onChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>

        {/* Matching criteria summary */}
        {(profileInterests > 0 || profileSkills > 0) && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-purple-700">You'll be matched on:</p>
            {user?.respondent_profile?.age_range && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-purple-400">•</span> Age: {user.respondent_profile.age_range}
              </div>
            )}
            {user?.respondent_profile?.employment_status && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-purple-400">•</span> Employment: {user.respondent_profile.employment_status.replace(/_/g, ' ')}
              </div>
            )}
            {profileInterests > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(user.respondent_profile.interests || []).slice(0, 6).map(i => (
                  <Badge key={i} className="text-xs bg-purple-100 text-purple-700 h-5">{i}</Badge>
                ))}
                {profileInterests > 6 && <Badge className="text-xs bg-purple-100 text-purple-700 h-5">+{profileInterests - 6} more</Badge>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}