import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Info, CheckCircle2, Loader2, Image } from "lucide-react";
import { toast } from "sonner";
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import AISurveyBuilder from '@/components/ppc/AISurveyBuilder';
import AIQuestionGenerator from '@/components/ppc/AIQuestionGenerator';
import SkipLogicBuilder from '@/components/ppc/SkipLogicBuilder';
import { useCollabSession, CollabAvatars, CollabFieldHighlight } from '@/components/ppc/CollabCursors';
import SurveyTargetingFilter from '@/components/ppc/SurveyTargetingFilter';

const SURVEY_TYPES = {
  data_collection: {
    label: 'Type 1 — Data Collection Survey',
    description: 'Collect data from 100 users. $4 per completed response. Minimum spend: $400.',
    costPerResponse: 4,
    minResponses: 100,
    minSpend: 400,
  },
  product_listing: {
    label: 'Type 2 — Product Listing Survey',
    description: 'Promote your product with 10 questions sent to all users. $4 per survey that generates a sale. +10% platform fee added to sale price.',
    costPerSale: 4,
    feePct: 10,
  }
};

export default function SurveyPublisherForm({ user }) {
  const [surveyType, setSurveyType] = useState('');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [collabSurveyId, setCollabSurveyId] = useState(null);
  const [targeting, setTargeting] = useState({});
  const queryClient = useQueryClient();

  // Live collaboration (only active once a survey draft is created/selected)
  const { collaborators, updateCursor } = useCollabSession(collabSurveyId, user);

  const [formData, setFormData] = useState({
    title: '',
    productDescription: '',
    productPrice: '',
    productImageUrl: '',
    sampleSize: 100,
    questions: Array(10).fill(null).map(() => ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '' })),
    skipLogic: [],
  });

  const selectedType = SURVEY_TYPES[surveyType];
  const totalCost = surveyType === 'data_collection'
    ? Math.max(formData.sampleSize, 100) * 4
    : null;
  const priceWithFee = formData.productPrice ? (parseFloat(formData.productPrice) * 1.10).toFixed(2) : null;

  const handleQuestionsFromAI = (questions, title) => {
    setFormData(prev => ({
      ...prev,
      questions: questions.slice(0, 10),
      title: prev.title || title,
    }));
    setStep(3);
  };

  const updateQuestion = (i, field, value) => {
    const updated = [...formData.questions];
    updated[i] = { ...updated[i], [field]: value };
    setFormData(prev => ({ ...prev, questions: updated }));
  };

  const handleSubmit = async () => {
    if (!surveyType) { toast.error('Please select a survey type'); return; }
    if (!formData.title) { toast.error('Please enter a survey title'); return; }
    const hasQuestions = formData.questions.some(q => q.question.trim());
    if (!hasQuestions) { toast.error('Please add at least some questions (or use AI to generate them)'); return; }

    setSubmitting(true);
    try {
      const price = parseFloat(formData.productPrice) || 0;
      await base44.entities.PPCSurvey.create({
        creator_user_id: user.id,
        tier: 1,
        survey_type: surveyType,
        title: formData.title,
        product_description: formData.productDescription,
        product_image_url: formData.productImageUrl,
        product_price: price,
        price_with_fee: price * 1.10,
        sample_size: formData.sampleSize,
        cost_per_response: 4,
        min_spend: surveyType === 'data_collection' ? Math.max(formData.sampleSize, 100) * 4 : 400,
        questions: formData.questions.filter(q => q.question.trim()),
        skip_logic: formData.skipLogic || [],
        status: 'draft',
        ai_generated: formData.questions.some(q => q.question.trim()),
      });
      queryClient.invalidateQueries(['ppc-surveys-active']);
      setSubmitted(true);
      toast.success('Survey submitted! It will go live after review.');
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Survey Submitted!</h3>
          <p className="text-gray-500 mb-6">Your survey will be reviewed and activated within 24 hours.</p>
          <Button onClick={() => { setSubmitted(false); setStep(1); setSurveyType(''); }} variant="outline">
            Submit Another Survey
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-purple-900">Publish a Survey — One-Click AI Creation</p>
            <p className="text-sm text-purple-800 mt-0.5">
              Select your survey type, describe what you want, and let AI generate 10 professional questions with A/B/C/D answers instantly. A 10% platform fee is applied to all purchases.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 — Type */}
      <Card className="border-0 shadow-lg">
        <CardHeader><CardTitle>Step 1 — Select Survey Type</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={surveyType} onValueChange={v => { setSurveyType(v); setStep(2); }}>
            <SelectTrigger className="w-full border-2">
              <SelectValue placeholder="Choose survey type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_collection">
                Type 1 — Data Collection ($4/completed response · min $400)
              </SelectItem>
              <SelectItem value="product_listing">
                Type 2 — Product Listing ($4/sale generated · +10% fee)
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedType && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="font-semibold text-blue-900 mb-1">{selectedType.label}</p>
              <p className="text-sm text-blue-800">{selectedType.description}</p>
              <div className="flex gap-2 flex-wrap mt-3">
                {surveyType === 'data_collection' && (
                  <>
                    <Badge className="bg-blue-200 text-blue-800">$4 per response</Badge>
                    <Badge className="bg-blue-200 text-blue-800">Min. 100 responses</Badge>
                    <Badge className="bg-blue-200 text-blue-800">Min. $400 spend</Badge>
                  </>
                )}
                {surveyType === 'product_listing' && (
                  <>
                    <Badge className="bg-purple-200 text-purple-800">$4 per sale</Badge>
                    <Badge className="bg-purple-200 text-purple-800">10 questions</Badge>
                    <Badge className="bg-purple-200 text-purple-800">Sent to all users</Badge>
                    <Badge className="bg-orange-200 text-orange-800">+10% platform fee</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {surveyType && (
        <>
          {/* Step 2 — Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader><CardTitle>Step 2 — Survey Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Survey Title</label>
                <Input placeholder="Enter survey title…" value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="border-2" />
              </div>

              {surveyType === 'data_collection' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Sample Size (min. 100)</label>
                  <Input type="number" min={100} value={formData.sampleSize}
                    onChange={e => setFormData(p => ({ ...p, sampleSize: parseInt(e.target.value) || 100 }))} className="border-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    Estimated total cost: <strong>${(Math.max(formData.sampleSize, 100) * 4).toLocaleString()}</strong>
                  </p>
                </div>
              )}

              {surveyType === 'product_listing' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Product Image URL</label>
                    <Input placeholder="https://..." value={formData.productImageUrl}
                      onChange={e => setFormData(p => ({ ...p, productImageUrl: e.target.value }))} className="border-2" />
                    {formData.productImageUrl && (
                      <img src={formData.productImageUrl} alt="Preview" className="mt-2 h-32 w-full object-contain rounded-xl border" />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block flex justify-between">
                      Product Description
                      <span className={`text-xs ${formData.productDescription.length > 180 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        {formData.productDescription.length}/180
                      </span>
                    </label>
                    <textarea rows={3} maxLength={180}
                      placeholder="Describe your product in 180 characters or less…"
                      value={formData.productDescription}
                      onChange={e => setFormData(p => ({ ...p, productDescription: e.target.value }))}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Sale Price ($)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-bold">$</span>
                      <Input type="number" placeholder="0.00" value={formData.productPrice}
                        onChange={e => setFormData(p => ({ ...p, productPrice: e.target.value }))} className="border-2" />
                    </div>
                    {priceWithFee && (
                      <p className="text-xs text-gray-500 mt-1">
                        Buyer pays: <strong>${priceWithFee}</strong> (includes 10% platform fee)
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Quick Question Generator */}
          <AIQuestionGenerator
            surveyTitle={formData.title}
            surveyType={surveyType}
            onQuestionsGenerated={handleQuestionsFromAI}
          />

          {/* Step 3 — AI Question Builder (full paid flow) */}
          <AISurveyBuilder
            surveyType={surveyType}
            productName={formData.title}
            onQuestionsGenerated={handleQuestionsFromAI}
          />

          {/* Skip Logic Builder */}
          <SkipLogicBuilder
            questions={formData.questions}
            skipLogic={formData.skipLogic}
            onChange={rules => setFormData(p => ({ ...p, skipLogic: rules }))}
          />

          {/* Step 4 — Review/Edit Questions */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Step 3 — Review Questions (10)</CardTitle>
              <p className="text-sm text-gray-500">Each question needs A, B, C, D answer options. Use AI above to auto-fill.</p>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
              {formData.questions.map((q, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
                  <label className="text-xs font-semibold text-gray-400">Question {i + 1}</label>
                  <CollabFieldHighlight collaborators={collaborators} questionIndex={i} field="question">
                   <Input placeholder={`Question ${i + 1}…`} value={q.question}
                     onFocus={() => updateCursor(i, 'question')}
                     onChange={e => updateQuestion(i, 'question', e.target.value)} className="bg-white" />
                  </CollabFieldHighlight>
                  <div className="grid grid-cols-2 gap-2">
                    {['a', 'b', 'c', 'd'].map(opt => (
                      <div key={opt} className="flex items-center gap-1">
                        <span className="text-xs font-bold text-purple-500 uppercase w-4">{opt}.</span>
                        <Input placeholder={`Answer ${opt.toUpperCase()}`} value={q[`option_${opt}`] || ''}
                          onChange={e => updateQuestion(i, `option_${opt}`, e.target.value)}
                          className="text-xs bg-white h-8" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-blue-50">
            <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-bold text-gray-900">Ready to Launch?</p>
                <p className="text-sm text-gray-500">
                  {surveyType === 'data_collection'
                    ? `Total estimated cost: $${(Math.max(formData.sampleSize, 100) * 4).toLocaleString()}`
                    : 'Cost: $4.00 per sale + 10% on sale price'}
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={submitting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8">
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  : 'Submit Survey for Review'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}