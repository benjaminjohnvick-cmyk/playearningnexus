import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Sparkles, RefreshCw, CheckCircle2, Edit3, Save,
  AlertCircle, CreditCard, DollarSign, Users, Lock, ChevronRight
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const COST_PER_RESPONSE = 4;
const MIN_SAMPLE_SIZE = 100;

// ── Payment form (inner, needs Stripe hooks) ──────────────────────────────────
function PaymentForm({ surveyTitle, sampleSize, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const totalCost = sampleSize * COST_PER_RESPONSE;

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setError(null);
    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (pmError) {
      setError(pmError.message);
      setProcessing(false);
      return;
    }

    try {
      const res = await base44.functions.invoke('chargeSurveyCreation', {
        paymentMethodId: paymentMethod.id,
        sampleSize,
        surveyTitle,
      });

      if (res.data?.success) {
        toast.success(`✅ Payment of $${totalCost} confirmed! Generating your survey…`);
        onSuccess();
      } else if (res.data?.requires_action) {
        const { error: confirmError } = await stripe.confirmCardPayment(res.data.client_secret);
        if (confirmError) {
          setError(confirmError.message);
        } else {
          toast.success(`✅ Payment of $${totalCost} confirmed! Generating your survey…`);
          onSuccess();
        }
      } else {
        setError(res.data?.error || 'Payment failed. Please try again.');
      }
    } catch (e) {
      setError('Payment service unavailable. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cost breakdown */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-bold text-indigo-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Survey Cost Breakdown
        </p>
        <div className="flex justify-between text-sm text-indigo-700">
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {sampleSize} responses</span>
          <span>× ${COST_PER_RESPONSE}.00 each</span>
        </div>
        <div className="border-t border-indigo-200 pt-2 flex justify-between font-black text-indigo-900 text-base">
          <span>Total charge</span>
          <span>${totalCost.toFixed(2)} USD</span>
        </div>
        <p className="text-xs text-indigo-500">You will be charged once survey is created. Earnings distributed to survey respondents at $4/response.</p>
      </div>

      {/* Card input */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1.5 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> Credit Card Details
        </label>
        <div className="border-2 border-gray-200 focus-within:border-purple-400 rounded-xl p-3.5 bg-white transition-colors">
          <CardElement options={{
            style: { base: { fontSize: '16px', color: '#374151', '::placeholder': { color: '#9ca3af' } } },
            hidePostalCode: false,
          }} />
        </div>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <Lock className="w-3 h-3" /> Secured by Stripe — your card details are never stored
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handlePay}
          disabled={processing || !stripe}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
        >
          {processing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
            : <><CreditCard className="w-4 h-4 mr-2" /> Pay ${totalCost.toFixed(2)}</>}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AISurveyBuilder({ surveyType, productName, onQuestionsGenerated, onSurveyCreated }) {
  const [prompt, setPrompt] = useState('');
  const [sampleSize, setSampleSize] = useState(MIN_SAMPLE_SIZE);
  const [step, setStep] = useState('prompt'); // 'prompt' | 'payment' | 'generating' | 'review'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [generatedSurvey, setGeneratedSurvey] = useState(null);

  const totalCost = Math.max(sampleSize, MIN_SAMPLE_SIZE) * COST_PER_RESPONSE;

  const handleProceedToPayment = () => {
    if (!prompt.trim()) { toast.error('Please describe what your survey should cover'); return; }
    setStep('payment');
  };

  const handlePaymentSuccess = async () => {
    setStep('generating');
    setError(null);
    try {
      const res = await base44.functions.invoke('generateAISurvey', { prompt });
      if (res.data?.success) {
        setGeneratedSurvey({
          survey_id: res.data.survey_id,
          title: res.data.title,
          description: res.data.description,
          questions: res.data.questions,
        });
        setStep('review');
        toast.success('✨ Survey generated! Review and edit below, then publish.');
      } else {
        setError('AI generation failed. Please contact support for a refund.');
        setStep('payment');
      }
    } catch {
      setError('AI service unavailable. Please contact support for a refund.');
      setStep('payment');
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
        sample_size: Math.max(sampleSize, MIN_SAMPLE_SIZE),
        cost_per_response: COST_PER_RESPONSE,
        status: 'active',
      });
      toast.success('🎉 Survey published and now accepting responses!');
      if (onSurveyCreated) onSurveyCreated(generatedSurvey.survey_id);
      if (onQuestionsGenerated) onQuestionsGenerated(generatedSurvey.questions, generatedSurvey.title);
      // Reset
      setStep('prompt');
      setPrompt('');
      setGeneratedSurvey(null);
      setSampleSize(MIN_SAMPLE_SIZE);
    } catch {
      toast.error('Failed to publish survey. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Survey Builder
          <Badge className="bg-purple-100 text-purple-700 text-xs">Powered by AI</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Describe your research goal and AI builds a 10-question survey. Respondents earn $4 each — charged to your card upfront.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {['Describe', 'Pay', 'Review'].map((label, i) => {
            const stepIndex = { prompt: 0, payment: 1, generating: 1, review: 2 }[step];
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1 font-semibold ${active ? 'text-purple-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${active ? 'border-purple-600 text-purple-600' : 'border-gray-300'}`}>{i + 1}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="w-3 h-3" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* STEP 1: Describe */}
        {step === 'prompt' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">What do you want to research?</label>
              <textarea
                rows={3}
                className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                placeholder={`e.g. "I want to understand how likely people are to switch from gas motorcycles to electric motorcycles"`}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Sample Size (min {MIN_SAMPLE_SIZE} respondents)
              </label>
              <Input
                type="number"
                min={MIN_SAMPLE_SIZE}
                step={50}
                value={sampleSize}
                onChange={e => setSampleSize(Math.max(MIN_SAMPLE_SIZE, parseInt(e.target.value) || MIN_SAMPLE_SIZE))}
                className="border-2 border-purple-200 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">{sampleSize} respondents × $4 = <span className="font-bold text-purple-700">${totalCost.toFixed(2)} total</span></p>
            </div>

            {/* Cost preview */}
            <div className="flex items-center gap-3 bg-white border-2 border-purple-100 rounded-xl p-3">
              <DollarSign className="w-8 h-8 text-purple-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Total charge: <span className="text-purple-700">${totalCost.toFixed(2)}</span></p>
                <p className="text-xs text-gray-400">Distributed to {sampleSize} survey respondents at $4 each</p>
              </div>
              <CreditCard className="w-5 h-5 text-gray-400" />
            </div>

            <Button
              onClick={handleProceedToPayment}
              disabled={!prompt.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" /> Continue to Payment — ${totalCost.toFixed(2)}
            </Button>
          </div>
        )}

        {/* STEP 2: Payment */}
        {(step === 'payment') && (
          <Elements stripe={stripePromise}>
            <PaymentForm
              surveyTitle={prompt.slice(0, 60)}
              sampleSize={Math.max(sampleSize, MIN_SAMPLE_SIZE)}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setStep('prompt')}
            />
          </Elements>
        )}

        {/* Generating spinner */}
        {step === 'generating' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto" />
            <p className="font-semibold text-gray-700">Generating your survey with AI…</p>
            <p className="text-sm text-gray-400">Building 10 targeted questions based on your research goal</p>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 'review' && generatedSurvey && (
          <div className="space-y-3">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="bg-white rounded-xl border border-purple-100 p-3 space-y-2">
              <div>
                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Survey Title</label>
                <input
                  className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-purple-400 py-0.5 mt-0.5"
                  value={generatedSurvey.title}
                  onChange={e => setGeneratedSurvey(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Description</label>
                <input
                  className="w-full text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-purple-300 py-0.5 mt-0.5"
                  value={generatedSurvey.description}
                  onChange={e => setGeneratedSurvey(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> 10 Questions — click any field to edit
              </p>
              <Badge className="bg-green-100 text-green-700">Paid ✓</Badge>
            </div>

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
                          className="flex-1 text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-purple-300"
                          value={q[`option_${opt}`] || ''}
                          onChange={e => updateQuestion(i, `option_${opt}`, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing…</>
                : <><Save className="w-4 h-4 mr-2" /> Publish Survey</>}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}