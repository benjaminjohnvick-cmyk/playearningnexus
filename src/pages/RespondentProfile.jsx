import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, User, CheckCircle2, Plus, X, Shield, Star, Target, Briefcase, BookOpen, DollarSign, Home, Heart } from 'lucide-react';
import { toast } from 'sonner';

const INTERESTS = [
  'Gaming', 'Technology', 'Finance', 'Health & Fitness', 'Travel', 'Food & Cooking',
  'Fashion', 'Sports', 'Music', 'Movies & TV', 'Books', 'Automotive', 'Home & Garden',
  'Parenting', 'Pets', 'Business', 'Science', 'Politics', 'Environment', 'Art & Design'
];

const SKILLS = [
  'Software Development', 'Marketing', 'Graphic Design', 'Data Analysis', 'Writing',
  'Teaching', 'Healthcare', 'Finance & Accounting', 'Legal', 'Engineering',
  'Sales', 'Customer Service', 'Project Management', 'Photography', 'Cooking'
];

const LIFESTYLE_TAGS = [
  'Remote Worker', 'Commuter', 'Homeowner', 'Renter', 'Vegan', 'Vegetarian',
  'Fitness Enthusiast', 'Online Shopper', 'Early Adopter', 'Coffee Lover',
  'Outdoor Enthusiast', 'Night Owl', 'Morning Person', 'Social Media User', 'Gamer'
];

function ProfileCompletionBar({ profile }) {
  const fields = ['age_range', 'gender', 'country', 'employment_status', 'education_level', 'household_income'];
  const filled = fields.filter(f => profile?.[f]).length;
  const hasInterests = (profile?.interests?.length || 0) >= 3;
  const hasSkills = (profile?.verified_skills?.length || 0) >= 1;
  const total = fields.length + 2;
  const done = filled + (hasInterests ? 1 : 0) + (hasSkills ? 1 : 0);
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-700">Profile Completion</span>
        <span className={`font-bold ${pct === 100 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-gray-400">
        {pct === 100 ? '✅ Full profile unlocks premium surveys with higher payouts.' : `Complete your profile to unlock higher-paying targeted surveys (+${100 - pct}% remaining)`}
      </p>
    </div>
  );
}

function TagPicker({ label, icon: IconComp, options, selected = [], onChange, max = 8 }) {
  const Icon = IconComp;
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-purple-500" /> {label} <span className="text-gray-400 font-normal">({selected.length}/{max})</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => {
                if (active) onChange(selected.filter(s => s !== opt));
                else if (selected.length < max) onChange([...selected, opt]);
              }}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
            >
              {active && <span className="mr-1">✓</span>}{opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RespondentProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setProfile(u.respondent_profile || {});
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields = ['age_range', 'gender', 'country', 'employment_status', 'education_level', 'household_income'];
      const filled = fields.filter(f => profile[f]).length;
      const hasInterests = (profile.interests?.length || 0) >= 3;
      const hasSkills = (profile.verified_skills?.length || 0) >= 1;
      const pct = Math.round(((filled + (hasInterests ? 1 : 0) + (hasSkills ? 1 : 0)) / (fields.length + 2)) * 100);

      await base44.auth.updateMe({
        respondent_profile: { ...profile, profile_complete: pct === 100 }
      });
      toast.success('Profile saved!');
    } catch { toast.error('Failed to save profile'); }
    finally { setSaving(false); }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-purple-600" /> Respondent Profile
          </h1>
          <p className="text-gray-500 text-sm">A detailed profile helps creators target you for higher-paying surveys that match your background.</p>
        </div>

        {/* Completion bar */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <ProfileCompletionBar profile={profile} />
          </CardContent>
        </Card>

        {/* Demographics */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-purple-600" /> Demographics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { field: 'age_range', label: 'Age Range', options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] },
              { field: 'gender', label: 'Gender', options: ['male', 'female', 'non_binary', 'prefer_not_to_say'] },
            ].map(({ field, label, options }) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                <Select value={profile[field] || ''} onValueChange={v => update(field, v)}>
                  <SelectTrigger className="border-2 h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 block mb-1">Country</label>
              <Input placeholder="e.g. United States" value={profile.country || ''} onChange={e => update('country', e.target.value)} className="border-2 h-9 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Economic profile */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-600" /> Economic Profile</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { field: 'employment_status', label: 'Employment', options: ['employed_full', 'employed_part', 'self_employed', 'student', 'unemployed', 'retired'] },
              { field: 'education_level', label: 'Education', options: ['high_school', 'some_college', 'bachelors', 'masters', 'phd', 'other'] },
              { field: 'household_income', label: 'Household Income', options: ['under_25k', '25k_50k', '50k_75k', '75k_100k', 'over_100k', 'prefer_not_to_say'] },
              { field: 'industry', label: 'Industry' },
            ].map(({ field, label, options }) => (
              <div key={field} className={!options ? 'col-span-2' : ''}>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                {options ? (
                  <Select value={profile[field] || ''} onValueChange={v => update(field, v)}>
                    <SelectTrigger className="border-2 h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="e.g. Technology" value={profile[field] || ''} onChange={e => update(field, e.target.value)} className="border-2 h-9 text-sm" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Household Info */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Home className="w-4 h-4 text-green-600" /> Household</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { field: 'marital_status', label: 'Marital Status', options: ['single', 'married', 'partnered', 'divorced', 'widowed', 'prefer_not_to_say'] },
              { field: 'household_size', label: 'Household Size', options: ['1', '2', '3', '4', '5', '6+'] },
              { field: 'has_children', label: 'Has Children', options: ['yes', 'no', 'prefer_not_to_say'] },
              { field: 'housing_type', label: 'Housing Type', options: ['own_home', 'renting', 'with_family', 'student_housing', 'other'] },
            ].map(({ field, label, options }) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                <Select value={profile[field] || ''} onValueChange={v => update(field, v)}>
                  <SelectTrigger className="border-2 h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Interests & Skills */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Interests, Skills & Lifestyle</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <TagPicker label="Interests (select at least 3)" icon={Star} options={INTERESTS} selected={profile.interests || []} onChange={v => update('interests', v)} max={10} />
            <TagPicker label="Verified Skills" icon={CheckCircle2} options={SKILLS} selected={profile.verified_skills || []} onChange={v => update('verified_skills', v)} max={8} />
            <TagPicker label="Lifestyle Tags" icon={Heart} options={LIFESTYLE_TAGS} selected={profile.lifestyle_tags || []} onChange={v => update('lifestyle_tags', v)} max={8} />
          </CardContent>
        </Card>

        {/* Stats (read-only) */}
        {(profile.surveys_completed > 0 || profile.avg_quality_score > 0) && (
          <Card className="border-0 shadow-md bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardContent className="p-4 flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-purple-700">{profile.surveys_completed || 0}</p>
                <p className="text-xs text-gray-500">Surveys Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-green-600">{profile.avg_quality_score || 0}</p>
                <p className="text-xs text-gray-500">Avg Quality Score</p>
              </div>
              {profile.profile_verified && (
                <div className="flex items-center gap-1.5 text-green-700 bg-green-100 px-3 py-1.5 rounded-full text-sm font-semibold ml-auto">
                  <Shield className="w-4 h-4" /> Verified Respondent
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white h-11 text-base font-semibold">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Save Profile</>}
        </Button>
      </div>
    </div>
  );
}