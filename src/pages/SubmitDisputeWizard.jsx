import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Upload, CheckCircle2, ArrowRight, FileText } from 'lucide-react';

export default function SubmitDisputeWizard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [selfAssessment, setSelfAssessment] = useState({ reason: '', expectedAmount: 0, confidence: 50 });
  const [user, setUser] = useState(null);

  // Fetch current user
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch user's transactions/activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['userActivities'],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ user_id: user?.id }, '', 50);
      const surveys = await base44.entities.PPCSurvey.filter({ creator_id: user?.id }, '', 50);
      return [
        ...orders.map(o => ({ ...o, type: 'order', display: `Order #${o.id?.slice(0, 8)} - $${o.amount}` })),
        ...surveys.map(s => ({ ...s, type: 'survey', display: `Survey: ${s.title}` }))
      ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user
  });

  // Mutation to submit dispute
  const submitMutation = useMutation({
    mutationFn: async () => {
      const claim = await base44.entities.DisputeClaim.create({
        user_id: user.id,
        subject: selectedActivity.type === 'order' ? `Order Dispute #${selectedActivity.id}` : `Survey Dispute: ${selectedActivity.title}`,
        activity_type: selectedActivity.type,
        activity_id: selectedActivity.id,
        reason: selfAssessment.reason,
        expected_resolution: selfAssessment.expectedAmount,
        user_confidence: selfAssessment.confidence,
        evidence_files: evidence,
        status: 'submitted',
        user_self_assessment: true,
        created_date: new Date().toISOString()
      });
      return claim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userActivities']);
      setStep(4);
    }
  });

  const handleEvidenceUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileUrl = await base44.integrations.Core.UploadFile({ file });
      setEvidence([...evidence, { name: file.name, url: fileUrl.file_url }]);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Please log in to submit a dispute.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8 flex gap-4">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                s < step ? 'bg-emerald-600 text-white' : s === step ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <ArrowRight className={`w-4 h-4 ${s < step ? 'text-emerald-600' : 'text-slate-300'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Activity */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Activity</CardTitle>
              <p className="text-sm text-slate-600 mt-2">Choose the order or survey you want to dispute</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {activitiesLoading ? (
                <p className="text-slate-500">Loading activities...</p>
              ) : activities.length === 0 ? (
                <p className="text-slate-500">No activities found.</p>
              ) : (
                activities.map(activity => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    onClick={() => setSelectedActivity(activity)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedActivity?.id === activity.id && selectedActivity?.type === activity.type
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{activity.display}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(activity.created_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={activity.type === 'order' ? 'default' : 'outline'}>
                        {activity.type}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedActivity}
                className="w-full bg-purple-600 hover:bg-purple-700 mt-4"
              >
                Continue to Evidence
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Upload Evidence */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Upload Evidence</CardTitle>
              <p className="text-sm text-slate-600 mt-2">Provide screenshots, logs, or documentation supporting your dispute</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={handleEvidenceUpload}
                  className="hidden"
                  id="evidence-upload"
                />
                <label htmlFor="evidence-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-900">Click to upload evidence</p>
                  <p className="text-xs text-slate-500">PNG, JPG, PDF (max 10MB)</p>
                </label>
              </div>

              {evidence.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Uploaded Files:</p>
                  {evidence.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="text-sm text-slate-700 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {file.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEvidence(evidence.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  Continue to Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Self-Assessment */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Self-Assessment</CardTitle>
              <p className="text-sm text-slate-600 mt-2">Tell us why you're disputing and what resolution you expect</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Reason for Dispute</label>
                <textarea
                  value={selfAssessment.reason}
                  onChange={(e) => setSelfAssessment({ ...selfAssessment, reason: e.target.value })}
                  placeholder="Explain why you're disputing this activity..."
                  className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Expected Resolution Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={selfAssessment.expectedAmount}
                  onChange={(e) => setSelfAssessment({ ...selfAssessment, expectedAmount: parseFloat(e.target.value) })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Confidence in Claim: {selfAssessment.confidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={selfAssessment.confidence}
                  onChange={(e) => setSelfAssessment({ ...selfAssessment, confidence: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {selfAssessment.confidence >= 80 ? '🟢 High Confidence' : selfAssessment.confidence >= 50 ? '🟡 Medium Confidence' : '🔴 Low Confidence'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">Your self-assessment will help our AI reviewer understand your perspective and make a fair decision.</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!selfAssessment.reason || submitMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Dispute Submitted!</h2>
              <p className="text-slate-600 mb-6">
                Your dispute has been received and sent to our AI resolver. You'll receive updates via email.
              </p>
              <Button
                onClick={() => window.location.href = '/DisputeClaimsUser'}
                className="bg-purple-600 hover:bg-purple-700"
              >
                View My Disputes
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}