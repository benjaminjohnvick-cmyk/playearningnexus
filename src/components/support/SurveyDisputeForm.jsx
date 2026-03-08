import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, Upload, FileText, Clock, CheckCircle2,
  XCircle, RefreshCw, Plus, Image as ImageIcon, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress: { label: 'In Review',   color: 'bg-yellow-100 text-yellow-700', icon: RefreshCw },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-600',   icon: XCircle },
};

export default function SurveyDisputeForm({ user }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [surveyName, setSurveyName] = useState('');
  const [surveyDate, setSurveyDate] = useState('');
  const [expectedReward, setExpectedReward] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch user's dispute tickets
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['survey-disputes', user?.id],
    queryFn: () => base44.entities.SupportTicket.filter({
      user_id: user.id,
      category: 'user_support',
    }, '-created_date', 20),
    enabled: !!user,
    select: (data) => data.filter(t => t.subject?.startsWith('[Survey Dispute]')),
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File must be under 5MB');
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setScreenshotUrl(file_url);
    setUploading(false);
    toast.success('Screenshot uploaded!');
  };

  const handleSubmit = async () => {
    if (!surveyName.trim()) return toast.error('Please enter the survey name');
    if (!description.trim()) return toast.error('Please describe the issue');

    setSubmitting(true);
    await base44.entities.SupportTicket.create({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      category: 'user_support',
      priority: 'medium',
      status: 'open',
      subject: `[Survey Dispute] ${surveyName}`,
      description: `Survey: ${surveyName}\nDate completed: ${surveyDate || 'Not specified'}\nExpected reward: ${expectedReward ? '$' + expectedReward : 'Not specified'}\n\nIssue description:\n${description}`,
      player_data_snapshot: {
        screenshot_url: screenshotUrl || null,
        survey_name: surveyName,
        survey_date: surveyDate,
        expected_reward: expectedReward,
      },
    });

    setSubmitting(false);
    queryClient.invalidateQueries(['survey-disputes', user?.id]);
    toast.success('Dispute submitted! We\'ll review it within 24–48 hours.');
    setSurveyName(''); setSurveyDate(''); setExpectedReward('');
    setDescription(''); setScreenshotUrl(''); setShowForm(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" /> Survey Dispute Center
          </CardTitle>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700 h-8">
              <Plus className="w-4 h-4 mr-1" /> New Dispute
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">Dispute rejected surveys by submitting proof of completion.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={showForm ? 'new' : 'history'} value={showForm ? 'new' : 'history'} onValueChange={(v) => setShowForm(v === 'new')}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="new"><Plus className="w-3.5 h-3.5 mr-1" />New Dispute</TabsTrigger>
            <TabsTrigger value="history"><FileText className="w-3.5 h-3.5 mr-1" />My Disputes ({tickets.length})</TabsTrigger>
          </TabsList>

          {/* New dispute form */}
          <TabsContent value="new" className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <strong>💡 Tip:</strong> Include a screenshot from the survey provider showing your completion. Disputes with proof are resolved 3x faster.
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Survey Name *</label>
                <Input
                  placeholder="e.g. Consumer Preferences Study"
                  value={surveyName}
                  onChange={e => setSurveyName(e.target.value)}
                  className="border-2 text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Date Completed</label>
                <Input
                  type="date"
                  value={surveyDate}
                  onChange={e => setSurveyDate(e.target.value)}
                  className="border-2 text-sm h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Expected Reward ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={expectedReward}
                  onChange={e => setExpectedReward(e.target.value)}
                  className="border-2 pl-7 text-sm h-9 w-40"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Describe the Issue *</label>
              <textarea
                placeholder="Explain what happened — e.g. 'I completed the full survey but was not credited. The survey was about household products and took approximately 12 minutes.'"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-red-400 placeholder:text-gray-300"
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Upload Screenshot / Proof</label>
              {screenshotUrl ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                  <img src={screenshotUrl} alt="proof" className="w-16 h-12 object-cover rounded-lg border" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Screenshot uploaded
                    </p>
                    <button onClick={() => setScreenshotUrl('')} className="text-xs text-red-500 hover:underline mt-0.5">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-red-300 hover:bg-red-50 transition-all">
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-2" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                  )}
                  <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Click to upload image'}</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !surveyName || !description}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {submitting ? 'Submitting...' : 'Submit Dispute'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="px-6">Cancel</Button>
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" /></div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No disputes filed yet.</p>
                <p className="text-xs mt-1">Use "New Dispute" to report a rejected survey.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const StatusIcon = cfg.icon;
                  const screenshotUrl = ticket.player_data_snapshot?.screenshot_url;
                  return (
                    <div key={ticket.id} className="border-2 border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {ticket.subject?.replace('[Survey Dispute] ', '') || 'Survey Dispute'}
                            </p>
                            <Badge className={`text-xs ${cfg.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" /> {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">
                            Submitted {ticket.created_date ? format(new Date(ticket.created_date), 'MMM d, yyyy') : '—'}
                            {ticket.player_data_snapshot?.expected_reward && (
                              <span className="ml-2 text-green-600 font-medium">Expected: ${ticket.player_data_snapshot.expected_reward}</span>
                            )}
                          </p>
                          {ticket.resolution && (
                            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                              <strong>Resolution:</strong> {ticket.resolution}
                            </div>
                          )}
                          {ticket.admin_notes && ticket.status !== 'closed' && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                              <strong>Support note:</strong> {ticket.admin_notes}
                            </div>
                          )}
                        </div>
                        {screenshotUrl && (
                          <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
                            <img src={screenshotUrl} alt="proof" className="w-14 h-10 object-cover rounded-lg border-2 border-gray-100 hover:border-blue-300 flex-shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}