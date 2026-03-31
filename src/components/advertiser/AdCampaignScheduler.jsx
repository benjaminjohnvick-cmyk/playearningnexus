import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, Plus, Trash2, CheckCircle, PauseCircle,
  PlayCircle, Loader2, Info, AlarmClock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isAfter, isBefore, isPast } from 'date-fns';

const STATUS_STYLES = {
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  active:    'bg-green-500/20 text-green-300 border-green-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-600',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_ICONS = {
  scheduled: <Clock className="w-3 h-3" />,
  active:    <PlayCircle className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
  cancelled: <PauseCircle className="w-3 h-3" />,
};

function computeStatus(schedule) {
  const now = new Date();
  const start = new Date(schedule.start_date);
  const end = new Date(schedule.end_date);
  if (schedule.status === 'cancelled') return 'cancelled';
  if (isPast(end)) return 'completed';
  if (isAfter(now, start) && isBefore(now, end)) return 'active';
  return 'scheduled';
}

export default function AdCampaignScheduler({ ads, userId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ad_id: ads[0]?.id || '', campaign_name: '', start_date: '', end_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(0);

  // Tick every minute to re-evaluate computed statuses + auto-apply
  useEffect(() => {
    const interval = setInterval(() => setTicking(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: schedules = [] } = useQuery({
    queryKey: ['adSchedules', userId],
    queryFn: () => base44.entities.AdSchedule.filter({ owner_user_id: userId }, '-start_date'),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  // Auto-apply schedules: resume/pause ads based on clock
  useEffect(() => {
    schedules.forEach(async (sched) => {
      if (sched.status === 'cancelled' || sched.status === 'completed') return;
      const computed = computeStatus(sched);

      if (computed === 'active' && sched.auto_resume_on_start) {
        const ad = ads.find(a => a.id === sched.ad_id);
        if (ad && ad.status === 'paused') {
          await base44.entities.AdListing.update(sched.ad_id, { status: 'active' }).catch(() => null);
          await base44.entities.AdSchedule.update(sched.id, { status: 'active' }).catch(() => null);
          qc.invalidateQueries(['adListings', userId]);
        }
      }

      if (computed === 'completed' && sched.auto_pause_on_end && sched.status !== 'completed') {
        const ad = ads.find(a => a.id === sched.ad_id);
        if (ad && ad.status === 'active') {
          await base44.entities.AdListing.update(sched.ad_id, { status: 'paused' }).catch(() => null);
        }
        await base44.entities.AdSchedule.update(sched.id, { status: 'completed' }).catch(() => null);
        qc.invalidateQueries(['adListings', userId]);
        qc.invalidateQueries(['adSchedules', userId]);
      }
    });
  }, [ticking, schedules.length]);

  const handleSave = async () => {
    if (!form.ad_id || !form.start_date || !form.end_date) {
      toast.error('Select an ad and both dates');
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      toast.error('End date must be after start date');
      return;
    }
    setSaving(true);
    await base44.entities.AdSchedule.create({
      ...form,
      owner_user_id: userId,
      status: 'scheduled',
      auto_resume_on_start: true,
      auto_pause_on_end: true,
    });
    qc.invalidateQueries(['adSchedules', userId]);
    setForm({ ad_id: ads[0]?.id || '', campaign_name: '', start_date: '', end_date: '', notes: '' });
    setShowForm(false);
    toast.success('Campaign schedule saved');
    setSaving(false);
  };

  const handleCancel = async (id) => {
    await base44.entities.AdSchedule.update(id, { status: 'cancelled' });
    qc.invalidateQueries(['adSchedules', userId]);
    toast.success('Schedule cancelled');
  };

  const handleDelete = async (id) => {
    await base44.entities.AdSchedule.delete(id);
    qc.invalidateQueries(['adSchedules', userId]);
  };

  if (ads.length === 0) {
    return <div className="text-center py-10 text-gray-500 text-sm">Submit an ad first to create a schedule.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Schedules auto-resume & pause ads based on your selected date range — no manual action needed.
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs gap-1 ml-3 flex-shrink-0">
          <Plus className="w-3 h-3" /> New Schedule
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-white font-bold text-sm flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-yellow-400" /> Schedule a Campaign
          </p>

          <Input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
            placeholder="Campaign name (e.g. Black Friday 2026)"
            className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />

          <div>
            <label className="text-gray-500 text-xs mb-1 block">Campaign</label>
            <select value={form.ad_id} onChange={e => setForm(f => ({ ...f, ad_id: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
              {ads.map(ad => <option key={ad.id} value={ad.id}>{ad.brand_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs mb-1 block flex items-center gap-1">
                <PlayCircle className="w-3 h-3 text-green-400" /> Start Date & Time
              </label>
              <input type="datetime-local" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block flex items-center gap-1">
                <PauseCircle className="w-3 h-3 text-orange-400" /> End Date & Time
              </label>
              <input type="datetime-local" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>

          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 text-black font-black text-xs h-8 gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />} Save Schedule
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-gray-600 text-gray-400 text-xs h-8">Cancel</Button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">No schedules yet. Create one to pre-load a seasonal campaign.</div>
      ) : (
        <div className="space-y-2">
          {schedules.map(sched => {
            const computed = computeStatus(sched);
            const ad = ads.find(a => a.id === sched.ad_id);
            return (
              <div key={sched.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex items-start gap-3">
                <AlarmClock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold text-sm">{sched.campaign_name || 'Unnamed schedule'}</p>
                    <Badge className={`${STATUS_STYLES[computed]} border text-[10px] flex items-center gap-1`}>
                      {STATUS_ICONS[computed]} {computed}
                    </Badge>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{ad ? ad.brand_name : sched.ad_id}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="w-3 h-3 text-green-400" />
                      {format(new Date(sched.start_date), 'MMM d, yyyy HH:mm')}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-1">
                      <PauseCircle className="w-3 h-3 text-orange-400" />
                      {format(new Date(sched.end_date), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  {sched.notes && <p className="text-gray-600 text-[11px] mt-1 italic">{sched.notes}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {computed === 'scheduled' && (
                    <button onClick={() => handleCancel(sched.id)} className="text-gray-600 hover:text-orange-400 transition-colors" title="Cancel">
                      <PauseCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(sched.id)} className="text-gray-600 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}