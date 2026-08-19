import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

// PremiumLockoutMode — for up-front PPC survey members. Lets them set a daily "lockout" time: a local
// time each day when the app gives them a focused, full-screen reminder to complete their ~8-minute
// survey commitment. This is an IN-APP focus/reminder mode (a web/native PWA can't lock the whole
// phone). Members who defaulted and re-enrolled must keep it ON; anyone may turn it on voluntarily.
// Renders only for up-front members (reads premiumPPCStatus). Nothing here charges or claws back points.
export default function PremiumLockoutMode() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [time, setTime] = useState('19:00');
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('premiumPPCStatus', {});
      const d = r.data || {};
      setStatus(d);
      if (d.lockout_time) setTime(d.lockout_time);
      setEnabled(d.lockout_mode_enabled !== false);
    } catch { setStatus(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(nextEnabled) {
    setSaving(true);
    try {
      const r = await base44.functions.invoke('premiumPPCSetLockoutTime', {
        enabled: nextEnabled,
        lockout_time: time,
      });
      if (r.data?.error) { toast.error(r.data.error); return; }
      setEnabled(r.data?.lockout_mode_enabled !== false);
      if (r.data?.lockout_time) setTime(r.data.lockout_time);
      toast.success(nextEnabled ? `Lockout reminder set for ${time} daily.` : 'Lockout mode turned off.');
    } catch (e) { toast.error(e?.data?.error || 'Could not save.'); }
    finally { setSaving(false); }
  }

  if (loading) return null;
  // Only relevant for up-front survey members.
  if (!status?.upfront_grant) return null;

  const pace = status.survey_pace;
  const makeup = status.makeup;
  const mins = status.survey_minutes_per_day || 8;
  const behind = !!pace?.behind;
  const required = status.defaulted || status.locked_out; // re-enrollment condition — can't turn off
  const sessionsToday = makeup?.remaining_sessions_today ?? 1;
  const minutesToday = makeup?.required_minutes_today ?? mins;
  const missedDays = makeup?.missed_days ?? 0;

  return (
    <Card className={behind ? 'border-2 border-amber-300' : ''}>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-indigo-600" /> Lockout mode
          {enabled ? <Badge variant="secondary">On</Badge> : <Badge variant="outline">Off</Badge>}
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A daily full-screen reminder to finish your {mins}-minute surveys and stay on pace. It nudges
          you in-app at the time you pick — it doesn’t lock your phone, and nothing is ever charged.
        </p>

        {/* Today's target — includes catch-up: one extra 8-min session per missed day. */}
        {makeup && !makeup.complete && (
          <div className={`mb-3 rounded-lg p-2 text-xs ${missedDays > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
            {sessionsToday > 0 ? (
              <span>
                <b>Today: complete {sessionsToday} session{sessionsToday === 1 ? '' : 's'} ({minutesToday} min).</b>{' '}
                {missedDays > 0
                  ? `That's your daily ${mins} min plus ${missedDays} make-up session${missedDays === 1 ? '' : 's'} for ${missedDays} missed day${missedDays === 1 ? '' : 's'}. Every missed day just adds one ${mins}-min session to a later day — you have the full year to make it up.`
                  : `You're on track — just your daily ${mins} minutes.`}
              </span>
            ) : (
              <span>✓ You're all caught up for today. Nice work.</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>Remind me daily at</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <Button size="sm" disabled={saving} onClick={() => save(true)}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {enabled ? 'Update time' : 'Turn on'}
          </Button>
          {enabled && !required && (
            <Button size="sm" variant="ghost" className="text-gray-400" disabled={saving} onClick={() => save(false)}>
              Turn off
            </Button>
          )}
        </div>
        {required && (
          <p className="mt-2 text-[11px] text-gray-400">Lockout mode is required for this term because a previous commitment wasn’t completed.</p>
        )}
      </CardContent>
    </Card>
  );
}
