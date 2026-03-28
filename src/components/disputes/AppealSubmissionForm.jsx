import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, Upload, Image as ImageIcon, Loader2,
  CheckCircle2, ChevronRight, FileText, Search, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const APPEAL_REASONS = [
  { key: 'technical_error', label: 'Technical error occurred during survey' },
  { key: 'incorrect_rejection', label: 'Rejection criteria incorrectly applied' },
  { key: 'time_discrepancy', label: 'Time recording was inaccurate' },
  { key: 'answer_misread', label: 'Answers were misinterpreted by system' },
  { key: 'connection_issue', label: 'Internet/connection issues affected responses' },
  { key: 'other', label: 'Other reason (please explain)' },
];

export default function AppealSubmissionForm({ user, onSubmitted }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1=select response, 2=reason, 3=details, 4=confirm
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [appealReason, setAppealReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch rejected/flagged responses for this user
  const { data: rejectedResponses = [], isLoading } = useQuery({
    queryKey: ['rejected-responses', user?.id],
    queryFn: async () => {
      const responses = await base44.entities.PPCSurveyResponse.filter(
        { user_id: user.id }, '-created_date', 100
      );
      return responses.filter(r => r.is_flagged || r.is_blocked || r.fraud_action === 'block' || r.fraud_action === 'flag');
    },
    enabled: !!user,
  });

  // Fetch survey titles for display
  const { data: surveys = [] } = useQuery({
    queryKey: ['survey-titles'],
    queryFn: () => base44.entities.PPCSurvey.list('-created_date', 200),
    enabled: !!user,
  });

  // Check existing appeals to prevent duplicates
  const { data: existingAppeals = [] } = useQuery({
    queryKey: ['user-disputes', user?.id],
    queryFn: () => base44.entities.SurveyDispute.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  const surveyMap = Object.fromEntries(surveys.map(s => [s.id, s]));
  const appealedResponseIds = new Set(existingAppeals.map(a => a.response_id).filter(Boolean));

  const filteredResponses = rejectedResponses.filter(r => {
    const survey = surveyMap[r.survey_id];
    const title = survey?.title || r.survey_id;
    return !search || title.toLowerCase().includes(search.toLowerCase());
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File must be under 5MB');
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEvidenceUrl(file_url);
    setUploading(false);
    toast.success('Evidence uploaded!');
  };

  const handleSubmit = async () => {
    if (!appealReason || !description.trim()) {
      return toast.error('Please complete all required fields');
    }
    setSubmitting(true);
    const survey = surveyMap[selectedResponse.survey_id];

    await base44.entities.SurveyDispute.create({
      user_id: user.id,
      response_id: selectedResponse.id,
      survey_id: selectedResponse.survey_id,
      survey_title: survey?.title || 'Survey Appeal',
      provider: 'platform',
      expected_amount: selectedResponse.payout_to_user || 0,
      description: `[APPEAL - ${appealReason.replace(/_/g, ' ').toUpperCase()}]\n\n${description}`,
      screenshot_url: evidenceUrl || null,
      transaction_id: selectedResponse.id,
      dispute_type: 'response_appeal',
      appeal_reason: appealReason,
      quality_score_at_time: selectedResponse.quality_score,
      fraud_reasons_at_time: selectedResponse.fraud_reasons || [],
      status: 'pending',
    });

    queryClient.invalidateQueries(['user-disputes', user?.id]);
    toast.success('Appeal submitted! Our AI will review your case shortly.');
    setSubmitting(false);
    if (onSubmitted) onSubmitted();
    // Reset
    setStep(1); setSelectedResponse(null); setAppealReason('');
    setDescription(''); setEvidenceUrl(''); setSearch('');
  };

  const STEPS = ['Select Response', 'Choose Reason', 'Provide Details', 'Confirm'];

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i + 1 < step ? 'bg-indigo-600 text-white' :
                i + 1 === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block text-center max-w-16 leading-tight ${i + 1 <= step ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-3 mx-1 transition-all ${i + 1 < step ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select rejected response */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Select the rejected/flagged response to appeal</p>
            <p className="text-xs text-gray-500">Only flagged or blocked responses are eligible for appeal</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search surveys..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No flagged or rejected responses found</p>
              <p className="text-xs text-gray-400 mt-1">Only responses that were flagged or blocked can be appealed</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredResponses.map(r => {
                const survey = surveyMap[r.survey_id];
                const alreadyAppealed = appealedResponseIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    disabled={alreadyAppealed}
                    onClick={() => { setSelectedResponse(r); setStep(2); }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      alreadyAppealed
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-100 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{survey?.title || 'Survey'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.created_date ? formatDistanceToNow(new Date(r.created_date), { addSuffix: true }) : ''}
                          {' · '}Quality: <span className={`font-medium ${(r.quality_score || 0) < 50 ? 'text-red-500' : 'text-orange-500'}`}>{r.quality_score ?? 'N/A'}/100</span>
                        </p>
                        {r.fraud_reasons?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.fraud_reasons.slice(0, 2).map(reason => (
                              <span key={reason} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{reason}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {alreadyAppealed
                          ? <Badge className="bg-gray-100 text-gray-500 text-xs">Appealed</Badge>
                          : r.is_blocked
                          ? <Badge className="bg-red-100 text-red-600 text-xs">Blocked</Badge>
                          : <Badge className="bg-orange-100 text-orange-600 text-xs">Flagged</Badge>
                        }
                        {!alreadyAppealed && <ChevronRight className="w-4 h-4 text-gray-400 mt-1 ml-auto" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Appeal reason */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
            <p className="font-semibold">Appealing: {surveyMap[selectedResponse?.survey_id]?.title || 'Survey'}</p>
            <p className="mt-0.5">Quality score: {selectedResponse?.quality_score ?? 'N/A'}/100 · Flags: {selectedResponse?.fraud_reasons?.join(', ') || 'none'}</p>
          </div>
          <p className="text-sm font-semibold text-gray-800">Why are you appealing this rejection?</p>
          <div className="space-y-2">
            {APPEAL_REASONS.map(r => (
              <button
                key={r.key}
                onClick={() => { setAppealReason(r.key); setStep(3); }}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                  appealReason === r.key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{r.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>
        </div>
      )}

      {/* Step 3: Details + evidence */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
            <p className="font-semibold">{APPEAL_REASONS.find(r => r.key === appealReason)?.label}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Describe your appeal in detail <span className="text-red-500">*</span></label>
            <textarea
              placeholder="Explain what happened during the survey and why the rejection was incorrect. Be as specific as possible..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-indigo-400 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Supporting Evidence (screenshot, screen recording, etc.)</label>
            {evidenceUrl ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                <img src={evidenceUrl} alt="evidence" className="w-14 h-10 object-cover rounded-lg border" />
                <div>
                  <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Evidence uploaded
                  </p>
                  <button onClick={() => setEvidenceUrl('')} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                {uploading ? <Loader2 className="w-7 h-7 text-indigo-400 animate-spin mb-2" /> : <ImageIcon className="w-7 h-7 text-gray-300 mb-2" />}
                <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Click to upload evidence'}</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB · Greatly increases approval odds</p>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            💡 <strong>Tip:</strong> Appeals with specific descriptions and evidence are reviewed by our AI system and resolved up to 5× faster. Our AI checks your full response history against quality guidelines.
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep(4)}
              disabled={!description.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Review Appeal <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-sm">
            <p className="font-bold text-gray-800">Appeal Summary</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Survey</span>
                <span className="font-medium text-gray-800">{surveyMap[selectedResponse?.survey_id]?.title || 'Survey'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reason</span>
                <span className="font-medium text-gray-800">{APPEAL_REASONS.find(r => r.key === appealReason)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quality score</span>
                <span className="font-medium text-orange-600">{selectedResponse?.quality_score ?? 'N/A'}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Evidence</span>
                <span className={evidenceUrl ? 'text-green-600 font-medium' : 'text-amber-600'}>
                  {evidenceUrl ? '✅ Included' : '⚠️ Not included'}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 mb-1">Your description:</p>
                <p className="text-gray-700">{description}</p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
            🤖 After submission, our <strong>AI Review Engine</strong> will automatically analyze your response data against survey quality guidelines and make a recommendation within minutes.
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
                : <><Upload className="w-4 h-4 mr-2" /> Submit Appeal</>
              }
            </Button>
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}