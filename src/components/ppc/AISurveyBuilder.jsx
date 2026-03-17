import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Sparkles, CheckCircle2, Edit3, Save,
  AlertCircle, DollarSign, Users, ChevronRight, FlaskConical
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import SurveyABTestBuilder from './SurveyABTestBuilder';

const COST_PER_RESPONSE = 4;
const MIN_SAMPLE_SIZE = 100;

// ── PayPal payment step ────────────────────────────────────────────────────────
function PayPalPaymentStep({ surveyTitle, sampleSize, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);

  const totalCost = Math.max(sampleSize, MIN_SAMPLE_SIZE) * COST_PER_RESPONSE;

  const handlePayPal = async () => {
    setLoading(true);
    try {
      const currentUrl = window.location.href.split('?')[0];
      const res = await base44.functions.invoke('createPayPalSurveyOrder', {
        sampleSize: Math.max(sampleSize, MIN_SAMPLE_SIZE),
        surveyTitle,
        returnUrl: `${currentUrl}?paypal=success`,
        cancelUrl: `${currentUrl}?paypal=cancel`,
      });

      if (res.data?.approval_url) {
        // Store order context in sessionStorage for after redirect
        sessionStorage.setItem('pp_survey_order', JSON.stringify({
          orderId: res.data.order_id,
          sampleSize: Math.max(sampleSize, MIN_SAMPLE_SIZE),
          surveyTitle,
        }));
        window.location.href = res.data.approval_url;
      } else {
        toast.error(res.data?.error || 'Failed to create PayPal order');
      }
    } catch {
      toast.error('PayPal service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-bold text-blue-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Survey Cost Breakdown
        </p>
        <div className="flex justify-between text-sm text-blue-700">
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {Math.max(sampleSize, MIN_SAMPLE_SIZE)} responses</span>
          <span>× ${COST_PER_RESPONSE}.00 each</span>
        </div>
        <div className="border-t border-blue-200 pt-2 flex justify-between font-black text-blue-900 text-base">
          <span>Total charge</span>
          <span>${totalCost.toFixed(2)} USD</span>
        </div>
        <p className="text-xs text-blue-400">You will be redirected to PayPal to complete payment securely.</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>Cancel</Button>
        <Button
          onClick={handlePayPal}
          disabled={loading}
          className="flex-1 bg-[#0070ba] hover:bg-[#003087] text-white font-bold"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</>
            : <><span className="text-lg mr-1">🅿</span> Pay ${totalCost.toFixed(2)} with PayPal</>}
        </Button>
      </div>
    </div>
  );
}

// ── Single survey builder ─────────────────────────────────────────────────────
function SingleSurveyBuilder({ onSurveyCreated, onQuestionsGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [sampleSize, setSampleSize] = useState(MIN_SAMPLE_SIZE);
  const [step, setStep] = useState('prompt'); // prompt | payment | generating | review
  const [saving, setSaving] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState(null);
  const [captureLoading, setCaptureLoading] = useState(false);

  const totalCost = Math.max(sampleSize, MIN_SAMPLE_SIZE) * COST_PER_RESPONSE;

  // Handle PayPal return
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get('paypal');
    const stored = sessionStorage.getItem('pp_survey_order');

    if (paypalStatus === 'success' && stored) {
      const { orderId, sampleSize: ss, surveyTitle } = JSON.parse(stored);
      sessionStorage.removeItem('pp_survey_order');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      captureAndGenerate(orderId, ss, surveyTitle);
    } else if (paypalStatus === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.removeItem('pp_survey_order');
      toast.error('PayPal payment cancelled.');
    }
  }, []);

  const captureAndGenerate = async (orderId, ss, surveyTitle) => {
    setCaptureLoading(true);
    setStep('generating');
    try {
      const captureRes = await base44.functions.invoke('capturePayPalSurveyOrder', {
        orderId, sampleSize: ss, surveyTitle,
      });

      if (!captureRes.data?.success) {
        toast.error(captureRes.data?.error || 'Payment capture failed.');
        setStep('prompt');
        setCaptureLoading(false);
        return;
      }

      toast.success(`✅ Payment of $${captureRes.data.amount_paid} confirmed!`);

      // Generate AI survey
      const genRes = await base44.functions.invoke('generateAISurvey', { prompt: surveyTitle });
      if (genRes.data?.success) {
        setGeneratedSurvey({
          survey_id: genRes.data.survey_id,
          title: genRes.data.title,
          description: genRes.data.description,
          questions: genRes.data.questions,
          sampleSize: ss,
        });
        setStep('review');
        toast.success('✨ Survey generated! Review and publish below.');
      } else {
        toast.error('AI generation failed. Please contact support for a refund.');
        setStep('prompt');
      }
    } catch {
      toast.error('Error processing payment. Please contact support.');
      setStep('prompt');
    } finally {
      setCaptureLoading(false);
    }
  };

  const updateQuestion = (i, field, value) => {
    setGeneratedSurvey(prev => {
      const updated = [...prev.questions];
      updated[i] = { ...updated[i], [field]: value };
      return { ...prev, questions: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.PPCSurvey.update(generatedSurvey.survey_id, {
        title: generatedSurvey.title,
        product_description: generatedSurvey.description,
        questions: generatedSurvey.questions,
        sample_size: generatedSurvey.sampleSize || MIN_SAMPLE_SIZE,
        cost_per_response: COST_PER_RESPONSE,
        status: 'active',
      });
      toast.success('🎉 Survey published!');
      if (onSurveyCreated) onSurveyCreated(generatedSurvey.survey_id);
      if (onQuestionsGenerated) onQuestionsGenerated(generatedSurvey.questions, generatedSurvey.title);
      setStep('prompt'); setPrompt(''); setGeneratedSurvey(null); setSampleSize(MIN_SAMPLE_SIZE);
    } catch {
      toast.error('Failed to publish survey.');
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = { prompt: 0, payment: 1, generating: 1, review: 2 }[step];

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {['Describe', 'Pay', 'Review'].map((label, i) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-1 font-semibold ${i === stepIndex ? 'text-purple-600' : i < stepIndex ? 'text-green-600' : 'text-gray-400'}`}>
              {i < stepIndex
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i === stepIndex ? 'border-purple-600 text-purple-600' : 'border-gray-300'}`}>{i + 1}</span>}
              {label}
            </div>
            {i < 2 && <ChevronRight className="w-3 h-3" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Describe */}
      {step === 'prompt' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">What do you want to research?</label>
            <textarea
              rows={3}
              className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              placeholder={`e.g. "Understanding consumer attitudes toward electric vehicles"`}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Sample Size (min {MIN_SAMPLE_SIZE})
            </label>
            <Input
              type="number" min={MIN_SAMPLE_SIZE} step={50}
              value={sampleSize}
              onChange={e => setSampleSize(Math.max(MIN_SAMPLE_SIZE, parseInt(e.target.value) || MIN_SAMPLE_SIZE))}
              className="border-2 border-purple-200 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">{Math.max(sampleSize, MIN_SAMPLE_SIZE)} respondents × $4 = <span className="font-bold text-purple-700">${totalCost.toFixed(2)}</span></p>
          </div>
          <Button
            onClick={() => setStep('payment')}
            disabled={!prompt.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
          >
            Continue to Payment — ${totalCost.toFixed(2)}
          </Button>
        </div>
      )}

      {/* STEP 2: PayPal Payment */}
      {step === 'payment' && (
        <PayPalPaymentStep
          surveyTitle={prompt}
          sampleSize={sampleSize}
          onSuccess={() => {}}
          onCancel={() => setStep('prompt')}
        />
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto" />
          <p className="font-semibold text-gray-700">{captureLoading ? 'Confirming payment…' : 'Generating your survey with AI…'}</p>
          <p className="text-sm text-gray-400">Building 10 targeted questions based on your research goal</p>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && generatedSurvey && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-purple-100 p-3 space-y-2">
            <div>
              <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Survey Title</label>
              <input
                className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-purple-400 py-0.5 mt-0.5"
                value={generatedSurvey.title}
                onChange={e => setGeneratedSurvey(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Description</label>
              <input
                className="w-full text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none py-0.5 mt-0.5"
                value={generatedSurvey.description}
                onChange={e => setGeneratedSurvey(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <p className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> 10 Questions — click any field to edit
            <Badge className="bg-green-100 text-green-700 ml-auto">Paid ✓</Badge>
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {generatedSurvey.questions.map((q, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-purple-600 bg-purple-100 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <input
                    className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-purple-400 pb-0.5"
                    value={q.question}
                    onChange={e => updateQuestion(i, 'question', e.target.value)}
                  />
                  <Edit3 className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-1 pl-7">
                  {['a', 'b', 'c', 'd'].map(opt => (
                    <div key={opt} className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase w-4">{opt}.</span>
                      <input
                        className="flex-1 text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none"
                        value={q[`option_${opt}`] || ''}
                        onChange={e => updateQuestion(i, `option_${opt}`, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing…</> : <><Save className="w-4 h-4 mr-2" /> Publish Survey</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AISurveyBuilder({ surveyType, productName, onQuestionsGenerated, onSurveyCreated }) {
  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Survey Builder
          <Badge className="bg-purple-100 text-purple-700 text-xs">Powered by AI</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Describe your research goal and AI builds a 10-question survey. Respondents earn $4 each — paid securely via PayPal.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="single">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="single" className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Single Survey
            </TabsTrigger>
            <TabsTrigger value="abtest" className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> A/B Split Test
            </TabsTrigger>
          </TabsList>
          <TabsContent value="single">
            <SingleSurveyBuilder onSurveyCreated={onSurveyCreated} onQuestionsGenerated={onQuestionsGenerated} />
          </TabsContent>
          <TabsContent value="abtest">
            <SurveyABTestBuilder />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}