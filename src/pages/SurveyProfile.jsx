import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SurveyProfile — the "CYK" master profile. The user fills their stable demographic/screening facts ONCE.
 * We use it to feed the survey provider's own profiler (so they get better-matched surveys and FAR fewer
 * disqualifications) and to pre-fill only repeated screening questions, which they still confirm.
 *
 * It never holds or fills the actual survey content — only these fixed demographic fields exist here. That
 * keeps every real answer genuine.
 */
const FIELDS = [
  { key: 'age_band', label: 'Age', options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] },
  { key: 'gender', label: 'Gender', options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'] },
  { key: 'country', label: 'Country', options: ['United States', 'Canada', 'United Kingdom', 'Australia', 'Other'] },
  { key: 'zip', label: 'ZIP / Postal code', type: 'text' },
  { key: 'income_band', label: 'Household income', options: ['<$25k', '$25-50k', '$50-75k', '$75-100k', '$100-150k', '$150k+'] },
  { key: 'household_size', label: 'Household size', options: ['1', '2', '3', '4', '5+'] },
  { key: 'employment_status', label: 'Employment', options: ['Full-time', 'Part-time', 'Self-employed', 'Student', 'Retired', 'Not employed'] },
  { key: 'education', label: 'Education', options: ['High school', 'Some college', 'Bachelor’s', 'Graduate', 'Other'] },
  { key: 'marital_status', label: 'Marital status', options: ['Single', 'Married', 'Partnered', 'Divorced', 'Widowed'] },
  { key: 'has_children', label: 'Children at home', options: ['Yes', 'No'] },
  { key: 'owns_home', label: 'Own or rent', options: ['Own', 'Rent', 'Other'] },
  { key: 'owns_car', label: 'Own a car', options: ['Yes', 'No'] },
  { key: 'primary_language', label: 'Primary language', options: ['English', 'Spanish', 'French', 'Other'] },
];

export default function SurveyProfile() {
  const [answers, setAnswers] = useState({});
  const [completeness, setCompleteness] = useState({ filled: 0, total: FIELDS.length, pct: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getSurveyProfile', {});
        if (res.data?.answers) setAnswers(res.data.answers);
        if (res.data?.completeness) setCompleteness(res.data.completeness);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const set = (key, val) => setAnswers((a) => ({ ...a, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveSurveyProfile', { answers });
      if (res.data?.success) { setCompleteness(res.data.completeness); toast.success('Profile saved — you’ll get better-matched surveys.'); }
      else toast.error(res.data?.error || 'Could not save.');
    } catch { toast.error('Could not save.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading your profile…</div>;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2"><UserCheck className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold">Your Survey Profile</h1></div>
      <p className="text-sm text-slate-500 mb-4">Fill these once. We use them to match you to surveys you actually qualify for — so you get disqualified far less and earn more per hour. These fixed facts are the only thing stored here; your real survey answers are never saved or auto-filled.</p>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Profile ({completeness.pct}% complete)</CardTitle>
          <div className="w-32 bg-slate-200 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${completeness.pct}%` }} /></div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-slate-600">{f.label}</label>
              {f.type === 'text' ? (
                <input value={answers[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}
                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm" placeholder={f.label} />
              ) : (
                <select value={answers[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}
                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white">
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Used only to match surveys — never to answer them.</p>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save profile'}</Button>
      </div>
    </div>
  );
}
