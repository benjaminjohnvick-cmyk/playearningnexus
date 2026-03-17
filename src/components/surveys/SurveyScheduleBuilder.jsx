import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Clock, Calendar } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SurveyScheduleBuilder({ surveyId, onScheduled }) {
  const [scheduleType, setScheduleType] = useState('one_time');
  const [launchDate, setLaunchDate] = useState('');
  const [launchTime, setLaunchTime] = useState('09:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [frequency, setFrequency] = useState('weekly');
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState('');

  const { mutate: schedule, isPending } = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      // Combine date and time
      const dateTimeStr = `${launchDate}T${launchTime}:00`;
      const launchDatetime = new Date(dateTimeStr).toISOString();

      const scheduleData = {
        survey_id: surveyId,
        creator_id: user.id,
        launch_datetime: launchDatetime,
        timezone,
        schedule_type: scheduleType
      };

      if (scheduleType === 'recurring') {
        scheduleData.recurrence_pattern = {
          frequency,
          interval: parseInt(interval),
          end_date: endDate || undefined
        };
      }

      const result = await base44.entities.SurveySchedule.create(scheduleData);
      return result;
    },
    onSuccess: () => {
      toast.success('Survey scheduled!');
      onScheduled?.();
    },
    onError: (error) => {
      toast.error('Failed to schedule survey');
      console.error(error);
    }
  });

  const isValid = launchDate && launchTime && (scheduleType === 'one_time' || frequency);

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-cyan-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-600" />
          Schedule Survey Launch
        </CardTitle>
        <CardDescription>Set automatic launch times and recurring patterns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Schedule Type */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-2 block">Schedule Type</label>
          <Select value={scheduleType} onValueChange={setScheduleType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">One-Time Launch</SelectItem>
              <SelectItem value="recurring">Recurring (Daily/Weekly/Monthly)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">Launch Date</label>
            <Input
              type="date"
              value={launchDate}
              onChange={(e) => setLaunchDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">Time (24hr)</label>
            <Input
              type="time"
              value={launchTime}
              onChange={(e) => setLaunchTime(e.target.value)}
            />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-2 block">Your Timezone</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
              <SelectItem value="Europe/London">London (GMT)</SelectItem>
              <SelectItem value="Europe/Paris">Central Europe</SelectItem>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
              <SelectItem value="Australia/Sydney">Australia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Recurring Options */}
        {scheduleType === 'recurring' && (
          <div className="space-y-4 p-3 bg-white rounded-lg border border-cyan-200">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">Frequency</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">Every N {frequency}(s)</label>
              <Input
                type="number"
                min="1"
                max="52"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">End Date (optional)</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={launchDate}
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to continue indefinitely</p>
            </div>
          </div>
        )}

        <Alert className="bg-blue-50 border-blue-200">
          <Calendar className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            Survey will automatically go live at the scheduled time. Respondents will see it in their queue immediately.
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => schedule()}
          disabled={!isValid || isPending}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Survey
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}