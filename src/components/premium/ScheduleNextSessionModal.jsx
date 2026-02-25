import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ScheduleNextSessionModal({ isOpen, onClose, user, membership, todaySession }) {
  const [selectedTime, setSelectedTime] = useState('09:00');
  const queryClient = useQueryClient();

  const scheduleNextSession = useMutation({
    mutationFn: async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [hours, minutes] = selectedTime.split(':');
      tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await base44.entities.LockoutSession.update(todaySession.id, {
        next_scheduled_time: tomorrow.toISOString(),
        exit_time: new Date().toISOString()
      });

      await base44.entities.PremiumMembership.update(membership.id, {
        next_session_scheduled_time: tomorrow.toISOString()
      });

      // Check if cycle is complete (365 days)
      const daysCompleted = (membership.days_completed || 0) + 1;
      if (daysCompleted >= 365) {
        if (membership.auto_renew_lockout) {
          const newEndDate = new Date();
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
          await base44.entities.PremiumMembership.update(membership.id, {
            days_completed: 0,
            lockout_cycle_count: (membership.lockout_cycle_count || 0) + 1,
            lockout_start_date: new Date().toISOString().split('T')[0],
            lockout_end_date: newEndDate.toISOString().split('T')[0]
          });
          toast.success('Lockout mode renewed for another year!');
        } else {
          await base44.entities.PremiumMembership.update(membership.id, {
            lockout_mode_enabled: false
          });
          toast.success('Lockout cycle complete! Lockout mode disabled.');
        }
      }

      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'survey_available',
        title: 'Session Scheduled',
        message: `Your next lockout session is scheduled for tomorrow at ${selectedTime}`,
        icon: 'Clock'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['lockout-session']);
      queryClient.invalidateQueries(['premium-membership']);
      toast.success(`Next session scheduled for tomorrow at ${selectedTime}`);
      onClose();
    },
    onError: () => {
      toast.error('Failed to schedule session');
    }
  });

  const handleSchedule = () => {
    if (!selectedTime) {
      toast.error('Please select a time');
      return;
    }
    scheduleNextSession.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Schedule Tomorrow's Session
          </DialogTitle>
          <DialogDescription>
            Pick a time to use the app tomorrow. Lockout mode will re-engage at this time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              <strong>Required:</strong> You must schedule your next session before exiting the app.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Select Time
            </Label>
            <Input
              id="time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="text-lg"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              Tomorrow's date: <strong>{new Date(Date.now() + 86400000).toLocaleDateString()}</strong>
              <br />
              Selected time: <strong>{selectedTime}</strong>
              <br />
              Days remaining in cycle: <strong>{365 - (membership?.days_completed || 0)}</strong>
            </p>
          </div>

          {membership?.auto_renew_lockout && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                ✓ Auto-renewal enabled: Your lockout mode will automatically renew for another year when this cycle completes.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSchedule}
            disabled={scheduleNextSession.isPending}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
          >
            {scheduleNextSession.isPending ? 'Scheduling...' : 'Confirm Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}