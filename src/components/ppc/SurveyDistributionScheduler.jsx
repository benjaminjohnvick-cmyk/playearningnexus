import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Mail, Twitter, Facebook, Linkedin, Calendar, Users, CheckCircle2, Brain, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'bg-sky-100 text-sky-700' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-blue-100 text-blue-800' },
];

const AUDIENCE_SEGMENTS = [
  'All Users',
  'Gamers (18–24)',
  'Gamers (25–34)',
  'High Earners ($50+ lifetime)',
  'New Users (joined last 30 days)',
  'Survey Power Users (10+ surveys)',
];

export default function SurveyDistributionScheduler({ user, aiWindow }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [socialCaption, setSocialCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const { data: surveys = [] } = useQuery({
    queryKey: ['my-surveys-dist', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }),
    enabled: !!user?.id
  });

  const toggleChannel = (id) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  const handleSchedule = async () => {
    if (!selectedSurveyId) { toast.error('Please select a survey'); return; }
    if (selectedChannels.length === 0) { toast.error('Select at least one channel'); return; }
    if (!selectedSegment) { toast.error('Select a target audience'); return; }
    if (!scheduleDate) { toast.error('Set a distribution date/time'); return; }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('scheduleSurveyDistribution', {
        survey_id: selectedSurveyId,
        survey_title: selectedSurvey?.title,
        channels: selectedChannels,
        audience_segment: selectedSegment,
        schedule_date: scheduleDate,
        email_subject: emailSubject || `You're invited: ${selectedSurvey?.title}`,
        social_caption: socialCaption || `Share your opinion! Take our survey: ${selectedSurvey?.title}`,
      });
      if (res.data?.success) {
        setScheduled(true);
        toast.success('Distribution scheduled successfully!');
      } else {
        toast.error(res.data?.error || 'Scheduling failed');
      }
    } catch {
      toast.error('Failed to schedule distribution');
    } finally {
      setSubmitting(false);
    }
  };

  if (scheduled) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Distribution Scheduled!</h3>
          <p className="text-gray-500 mb-2">
            Your survey will be sent to <strong>{selectedSegment}</strong> via <strong>{selectedChannels.join(', ')}</strong> on <strong>{new Date(scheduleDate).toLocaleString()}</strong>.
          </p>
          <Button onClick={() => { setScheduled(false); setSelectedSurveyId(''); setSelectedChannels([]); }} variant="outline" className="mt-4">
            Schedule Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Send className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900">Survey Distribution Scheduler</p>
            <p className="text-sm text-blue-700">Schedule your survey to be automatically distributed across email and social media channels to targeted audience segments.</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Window Banner */}
      {aiWindow && (
        <Card className="border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Brain className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> AI Recommended Window Applied
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                <strong>{aiWindow.window_label}</strong> · {aiWindow.utc_day} {aiWindow.utc_start_hour}:00–{aiWindow.utc_end_hour}:00 UTC ·{' '}
                Estimated completion rate: <strong>{aiWindow.estimated_completion_rate}%</strong> · Confidence: <strong>{aiWindow.confidence}%</strong>
              </p>
              <p className="text-xs text-indigo-600 mt-1">{aiWindow.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Survey */}
      <Card className="border-0 shadow-lg">
        <CardHeader><CardTitle>Step 1 — Select Survey</CardTitle></CardHeader>
        <CardContent>
          <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
            <SelectTrigger className="border-2">
              <SelectValue placeholder="Choose a survey to distribute…" />
            </SelectTrigger>
            <SelectContent>
              {surveys.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} · {s.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSurvey && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <Badge className="bg-purple-100 text-purple-700">{selectedSurvey.survey_type}</Badge>
              <Badge className="bg-gray-100 text-gray-600">{selectedSurvey.questions?.length || 0} questions</Badge>
              <Badge className={selectedSurvey.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {selectedSurvey.status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — Channels */}
      <Card className="border-0 shadow-lg">
        <CardHeader><CardTitle>Step 2 — Distribution Channels</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CHANNELS.map(ch => {
              const Icon = ch.icon;
              const selected = selectedChannels.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ch.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{ch.label}</span>
                  {selected && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                </button>
              );
            })}
          </div>

          {/* Channel-specific inputs */}
          {selectedChannels.includes('email') && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Email Subject Line</label>
              <Input
                placeholder={`You're invited: ${selectedSurvey?.title || 'Our Survey'}`}
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="border-2"
              />
            </div>
          )}
          {(selectedChannels.includes('twitter') || selectedChannels.includes('facebook') || selectedChannels.includes('linkedin')) && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Social Caption</label>
              <textarea
                rows={2}
                placeholder={`Share your opinion! Take our survey: ${selectedSurvey?.title || ''}`}
                value={socialCaption}
                onChange={e => setSocialCaption(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <p className="text-xs text-gray-400 mt-1">{socialCaption.length}/280 characters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — Audience & Schedule */}
      <Card className="border-0 shadow-lg">
        <CardHeader><CardTitle>Step 3 — Target Audience & Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" /> Audience Segment
            </label>
            <Select value={selectedSegment} onValueChange={setSelectedSegment}>
              <SelectTrigger className="border-2">
                <SelectValue placeholder="Select target audience…" />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_SEGMENTS.map(seg => (
                  <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Distribution Date & Time
            </label>
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="border-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary & Submit */}
      {selectedSurveyId && selectedChannels.length > 0 && selectedSegment && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-5 space-y-3">
            <p className="font-bold text-gray-900">Distribution Summary</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Survey</p><p className="font-semibold text-gray-800 truncate">{selectedSurvey?.title}</p></div>
              <div><p className="text-gray-500 text-xs">Channels</p><p className="font-semibold text-gray-800">{selectedChannels.join(', ')}</p></div>
              <div><p className="text-gray-500 text-xs">Audience</p><p className="font-semibold text-gray-800">{selectedSegment}</p></div>
            </div>
            <Button onClick={handleSchedule} disabled={submitting || !scheduleDate}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling…</>
                : <><Send className="w-4 h-4 mr-2" />Schedule Distribution</>}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}