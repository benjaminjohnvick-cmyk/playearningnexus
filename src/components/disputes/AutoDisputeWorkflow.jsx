import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle2, Clock, Bot, AlertCircle, Upload,
  DollarSign, Star, ChevronRight, Loader2, XCircle, Info
} from 'lucide-react';

const STEPS = ['details', 'evidence', 'review', 'submitted'];

const REJECT_REASONS = [
  { value: 'technical_error', label: 'Technical error / page crashed' },
  { value: 'incorrect_rejection', label: 'I answered correctly but was rejected' },
  { value: 'time_discrepancy', label: 'I completed it but got no credit' },
  { value: 'connection_issue', label: 'Connection dropped mid-survey' },
  { value: 'other', label: 'Other reason' },
];

export default function AutoDisputeWorkflow({ user }) {
  const [step, setStep] = useState('details');
  const [form, setForm] = useState({
    survey_title: '',
    expected_amount: '',
    reason: '',
    description: '',
    screenshot_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Fetch user quality score for auto-approval logic
  const { data: responses = [] } = useQuery({
    queryKey: ['dispute_responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const avgQuality = responses.length > 0
    ? responses.reduce((s, r) => s + (r.quality_score || 70), 0) / responses.length : 0;
  const isHighQuality = avgQuality >= 75;
  const surveysCompleted = responses.length;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, screenshot_url: file_url }));
    setUploading(false);
    toast.success('Screenshot uploaded!');
  };

  const runAutoWorkflow = async () => {
    setSubmitting(true);

    // 1. Create the dispute record
    const dispute = await base44.entities.SurveyDispute.create({
      user_id: user.id,
      survey_title: form.survey_title,
      expected_amount: parseFloat(form.expected_amount) || 0,
      appeal_reason: form.reason,
      description: form.description,
      screenshot_url: form.screenshot_url || null,
      dispute_type: 'missing_credit',
      quality_score_at_time: Math.round(avgQuality),
      status: 'reviewing',
    });

    // 2. Run AI review
    let aiDecision = null;
    try {
      aiDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a dispute resolution AI for a survey platform. Evaluate this dispute:

User Quality Score: ${avgQuality.toFixed(1)}/100
Surveys Completed: ${surveysCompleted}
Survey Title: ${form.survey_title}
Rejection Reason: ${form.reason}
User Description: ${form.description}
Has Screenshot Evidence: ${form.screenshot_url ? 'Yes' : 'No'}
Claimed Amount: $${form.expected_amount}

Rules:
- If quality score >= 75 AND user has 5+ surveys AND has a plausible reason → approve goodwill credit
- If quality score < 60 or description is vague → escalate to manual review
- Be concise. 

Return JSON: decision ('approved'|'escalated'|'rejected'), goodwill_amount (number, 0 if not approved), reason (1 sentence), needs_manual_review (boolean)`,
        response_json_schema: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            goodwill_amount: { type: 'number' },
            reason: { type: 'string' },
            needs_manual_review: { type: 'boolean' },
          },
        },
      });
    } catch {
      // Fallback logic
      aiDecision = {
        decision: isHighQuality && surveysCompleted >= 5 ? 'approved' : 'escalated',
        goodwill_amount: isHighQuality ? Math.min(parseFloat(form.expected_amount) || 1, 2) : 0,
        reason: isHighQuality
          ? 'High-quality user with consistent history — goodwill credit approved.'
          : 'Escalated for manual review by our team.',
        needs_manual_review: !isHighQuality,
      };
    }

    // 3. Apply decision
    if (aiDecision.decision === 'approved' && aiDecision.goodwill_amount > 0) {
      const newBalance = parseFloat(((user.current_balance || 0) + aiDecision.goodwill_amount).toFixed(2));
      await base44.auth.updateMe({ current_balance: newBalance });

      // Create payout record
      await base44.entities.Payout.create({
        user_id: user.id,
        amount: aiDecision.goodwill_amount,
        payout_type: 'goodwill_credit',
        status: 'completed',
        method: 'balance_credit',
        notes: `Goodwill credit for dispute: ${form.survey_title}`,
      }).catch(() => {});

      // Notify user
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'payout_processed',
        title: '✅ Dispute Approved — Goodwill Credit!',
        message: `$${aiDecision.goodwill_amount.toFixed(2)} goodwill credit added to your balance for your dispute on "${form.survey_title}"`,
        status: 'unread',
        delivery_method: ['in_app'],
      }).catch(() => {});
    }

    // 4. Update dispute status
    await base44.entities.SurveyDispute.update(dispute.id, {
      status: aiDecision.decision === 'approved' ? 'approved' : aiDecision.decision === 'rejected' ? 'rejected' : 'reviewing',
      admin_notes: aiDecision.reason,
      resolved_amount: aiDecision.goodwill_amount || 0,
      resolved_by: 'AI Auto-Review',
      resolved_date: new Date().toISOString(),
      review_task_created: aiDecision.needs_manual_review,
    }).catch(() => {});

    setResult(aiDecision);
    setStep('submitted');
    setSubmitting(false);
  };

  const canProceedToEvidence = form.survey_title.trim() && form.reason && form.expected_amount;
  const canSubmit = form.description.trim().length >= 20;

  // ── Step: submitted ──────────────────────────────────────────────────────
  if (step === 'submitted' && result) {
    const isApproved = result.decision === 'approved';
    const isEscalated = result.decision === 'escalated';

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`border-2 ${isApproved ? 'border-green-300' : isEscalated ? 'border-amber-300' : 'border-red-300'}`}>
          <CardContent className="p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isApproved ? 'bg-green-100' : isEscalated ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              {isApproved ? <CheckCircle2 className="w-10 h-10 text-green-500" /> :
               isEscalated ? <Clock className="w-10 h-10 text-amber-500" /> :
               <XCircle className="w-10 h-10 text-red-500" />}
            </div>

            <h3 className="text-2xl font-bold mb-2">
              {isApproved ? '✅ Dispute Approved!' : isEscalated ? '⏳ Escalated for Review' : '❌ Dispute Not Approved'}
            </h3>

            <p className="text-gray-600 mb-4">{result.reason}</p>

            {isApproved && result.goodwill_amount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-green-700 font-bold text-xl">${result.goodwill_amount.toFixed(2)} Goodwill Credit</p>
                <p className="text-green-600 text-sm">Added to your balance immediately</p>
              </div>
            )}

            {isEscalated && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 mb-4">
                <p className="font-semibold mb-1">What happens next?</p>
                <p>Our team will review your dispute within 2–3 business days. You'll receive a notification with the outcome.</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-2">
              <Bot className="w-3 h-3" />
              <span>Reviewed by AI in seconds · Quality score: {avgQuality.toFixed(0)}/100</span>
            </div>

            <Button
              onClick={() => { setStep('details'); setForm({ survey_title: '', expected_amount: '', reason: '', description: '', screenshot_url: '' }); setResult(null); }}
              variant="outline"
              className="mt-6"
            >
              Submit Another Dispute
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quality score banner */}
      <div className={`rounded-xl p-3 flex items-center gap-3 text-sm ${
        isHighQuality ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      }`}>
        <Star className={`w-5 h-5 flex-shrink-0 ${isHighQuality ? 'text-green-500' : 'text-amber-500'}`} />
        <div>
          <span className="font-semibold">{isHighQuality ? 'High-Trust Account' : 'Standard Account'}</span>
          <span className="text-gray-600"> · Quality score: {avgQuality.toFixed(0)}/100 · {surveysCompleted} surveys</span>
          {isHighQuality && <span className="text-green-700"> → Eligible for instant goodwill credits</span>}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[['details', 'Details'], ['evidence', 'Evidence'], ['review', 'Submit']].map(([s, label], i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-indigo-600 text-white' :
              STEPS.indexOf(step) > STEPS.indexOf(s) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {STEPS.indexOf(step) > STEPS.indexOf(s) ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${step === s ? 'text-indigo-700' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <ChevronRight className="w-3 h-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Details ── */}
      <AnimatePresence mode="wait">
        {step === 'details' && (
          <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="text-sm">Survey / Offer Name *</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Consumer Opinion Survey – Health"
                    value={form.survey_title}
                    onChange={e => setForm(f => ({ ...f, survey_title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Expected Reward Amount ($) *</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 2.50"
                    value={form.expected_amount}
                    onChange={e => setForm(f => ({ ...f, expected_amount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Reason for Dispute *</Label>
                  <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REJECT_REASONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  disabled={!canProceedToEvidence}
                  onClick={() => setStep('evidence')}
                >
                  Next: Add Evidence <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 2: Evidence ── */}
        {step === 'evidence' && (
          <motion.div key="evidence" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="text-sm">Describe What Happened *</Label>
                  <Textarea
                    className="mt-1 min-h-[100px]"
                    placeholder="Please explain in detail what occurred. The more specific, the better your chances of approval."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.description.length}/20 characters minimum</p>
                </div>

                <div>
                  <Label className="text-sm">Screenshot Evidence (optional — improves approval odds)</Label>
                  <div className={`mt-1 border-2 border-dashed rounded-xl p-4 text-center ${form.screenshot_url ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    {form.screenshot_url ? (
                      <div>
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-sm text-green-700 font-medium">Screenshot uploaded ✓</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 mb-2">Upload a screenshot of the completed survey or error</p>
                        <label className="cursor-pointer">
                          <span className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            {uploading ? 'Uploading...' : 'Choose File'}
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('details')} className="flex-1">Back</Button>
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={!canSubmit}
                    onClick={() => setStep('review')}
                  >
                    Review & Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2 text-sm">
                  <p className="font-semibold text-indigo-900 mb-2">Dispute Summary</p>
                  <div className="flex justify-between"><span className="text-gray-500">Survey:</span><span className="font-medium">{form.survey_title}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expected:</span><span className="font-medium text-green-600">${parseFloat(form.expected_amount || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Reason:</span><span className="font-medium capitalize">{form.reason?.replace(/_/g, ' ')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Evidence:</span><span className="font-medium">{form.screenshot_url ? 'Screenshot attached' : 'No screenshot'}</span></div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-xs text-blue-700">
                  <Bot className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">AI Auto-Review</p>
                    <p>Based on your quality score ({avgQuality.toFixed(0)}/100), you {isHighQuality ? 'are eligible for instant goodwill credit if approved.' : 'will be escalated to manual review.'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('evidence')} className="flex-1">Back</Button>
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={submitting}
                    onClick={runAutoWorkflow}
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : <><Shield className="w-4 h-4 mr-1" /> Submit Dispute</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}