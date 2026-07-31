import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Flame, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SurveyCommitmentPicker — the user picks the daily time they'll do their $8 of surveys. Sets their
 * commitment (used for the daily nudge + streak). Shows their current streak.
 */
export default function SurveyCommitmentPicker() {
  const [status, setStatus] = useState(null);
  const [hour, setHour] = useState('18');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('surveyCommitmentStatus', {});
      const d = res?.data || null;
      setStatus(d);
      if (d?.commit_hour != null) setHour(String(d.commit_hour));
    } catch { /* non-fatal */ }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const tz = -new Date().getTimezoneOffset(); // minutes to add to UTC for local
      const res = await base44.functions.invoke('setSurveyCommitment', { hour: Number(hour), tz_offset_minutes: tz });
      if (res?.data?.success) { toast.success('Daily survey time saved.'); await load(); }
      else toast.error(res?.data?.error || 'Could not save.');
    } catch { toast.error('Could not save your time.'); }
    finally { setSaving(false); }
  };

  const label = (h) => { const hr = ((h + 11) % 12) + 1; return `${hr}:00 ${h < 12 ? 'AM' : 'PM'}`; };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Your daily survey time</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 mb-3">
          Pick a time each day to do your ${status?.goal_usd || 8} of surveys. We'll send a reminder — never a lock — and keep your streak going.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded-md h-10 px-2 text-sm bg-white" value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{label(h)}</option>)}
          </select>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : <><Check className="w-4 h-4 mr-1" /> Save time</>}</Button>
          {status?.streak > 0 && (
            <span className="flex items-center gap-1 text-sm text-orange-600 font-semibold"><Flame className="w-4 h-4" /> {status.streak}-day streak</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
