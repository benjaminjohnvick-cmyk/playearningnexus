import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Info, CheckCircle2, Image, AlignLeft } from "lucide-react";
import { toast } from "sonner";

const SURVEY_TYPES = {
  type1: {
    label: 'Type 1 — Data Collection Survey',
    description: 'Collect data from a sample of 100 users. Cost: $4.00 per completed survey. Minimum spend: $400 (100 responses required).',
    costPerResponse: 4,
    minResponses: 100,
    minSpend: 400,
  },
  type2: {
    label: 'Type 2 — Product Listing Survey',
    description: 'Promote a product with 10 questions sent to all users. Cost: $4.00 per survey that generates a sale. Includes a product photo and 180-character description. 4 answer choices (A, B, C, D). A 10% platform fee is automatically added to the sale price.',
    costPerSale: 4,
    feePct: 10,
    maxDescChars: 180,
    questions: 10,
  }
};

export default function SurveyPublisherForm({ user }) {
  const [surveyType, setSurveyType] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    productDescription: '',
    productPrice: '',
    productImageUrl: '',
    sampleSize: 100,
    questions: ['', '', '', '', '', '', '', '', '', ''],
    answerOptions: [
      { a: '', b: '', c: '', d: '' },
    ]
  });
  const [submitted, setSubmitted] = useState(false);

  const selectedType = SURVEY_TYPES[surveyType];

  const handleSubmit = () => {
    if (!surveyType) { toast.error('Please select a survey type'); return; }
    if (!formData.title) { toast.error('Please enter a survey title'); return; }
    if (surveyType === 'type2' && formData.productDescription.length > 180) {
      toast.error('Product description must be 180 characters or less'); return;
    }
    toast.success('Survey submitted for review! Our team will contact you within 24 hours.');
    setSubmitted(true);
  };

  const updateQuestion = (index, value) => {
    const updated = [...formData.questions];
    updated[index] = value;
    setFormData(prev => ({ ...prev, questions: updated }));
  };

  if (submitted) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Survey Submitted!</h3>
          <p className="text-gray-500 mb-6">Our team will review your survey and reach out within 24 hours to process payment and launch.</p>
          <Button onClick={() => setSubmitted(false)} variant="outline">Submit Another Survey</Button>
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
            <p className="font-semibold text-purple-900 mb-1">Publish a Survey on the PPC Network</p>
            <p className="text-sm text-purple-800">
              Choose from two survey types below. Surveys are distributed to our active user base. 
              Select Type 1 for data collection or Type 2 to drive product sales.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Survey Type Selector */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Step 1 — Choose Survey Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={surveyType} onValueChange={setSurveyType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select survey type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="type1">Type 1 — Data Collection Survey ($4/completed response)</SelectItem>
              <SelectItem value="type2">Type 2 — Product Listing Survey ($4/sale generated)</SelectItem>
            </SelectContent>
          </Select>

          {selectedType && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-semibold text-blue-900 mb-1">{selectedType.label}</p>
              <p className="text-sm text-blue-800">{selectedType.description}</p>
              {surveyType === 'type1' && (
                <div className="mt-3 flex gap-4">
                  <Badge className="bg-blue-200 text-blue-800">$4 per response</Badge>
                  <Badge className="bg-blue-200 text-blue-800">Min. 100 responses</Badge>
                  <Badge className="bg-blue-200 text-blue-800">Min. spend: $400</Badge>
                </div>
              )}
              {surveyType === 'type2' && (
                <div className="mt-3 flex gap-4 flex-wrap">
                  <Badge className="bg-purple-200 text-purple-800">$4 per sale</Badge>
                  <Badge className="bg-purple-200 text-purple-800">10 questions</Badge>
                  <Badge className="bg-purple-200 text-purple-800">Sent to all users</Badge>
                  <Badge className="bg-purple-200 text-purple-800">+10% platform fee on sale</Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {surveyType && (
        <>
          {/* Basic Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Step 2 — Survey Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Survey Title</label>
                <Input
                  placeholder="Enter survey title..."
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {surveyType === 'type1' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Sample Size (min. 100)
                  </label>
                  <Input
                    type="number"
                    min={100}
                    value={formData.sampleSize}
                    onChange={e => setFormData(prev => ({ ...prev, sampleSize: parseInt(e.target.value) || 100 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Estimated cost: <strong>${(Math.max(formData.sampleSize, 100) * 4).toLocaleString()}</strong>
                  </p>
                </div>
              )}

              {surveyType === 'type2' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Product Image URL
                    </label>
                    <div className="flex gap-2">
                      <Image className="w-5 h-5 text-gray-400 mt-2 flex-shrink-0" />
                      <Input
                        placeholder="https://..."
                        value={formData.productImageUrl}
                        onChange={e => setFormData(prev => ({ ...prev, productImageUrl: e.target.value }))}
                      />
                    </div>
                    {formData.productImageUrl && (
                      <img src={formData.productImageUrl} alt="Preview" className="mt-2 h-32 object-contain rounded border" />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                      <AlignLeft className="w-4 h-4" />
                      Product Description
                      <span className={`text-xs ml-auto ${formData.productDescription.length > 180 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        {formData.productDescription.length}/180
                      </span>
                    </label>
                    <textarea
                      maxLength={180}
                      rows={3}
                      placeholder="Describe your product in 180 characters or less..."
                      value={formData.productDescription}
                      onChange={e => setFormData(prev => ({ ...prev, productDescription: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Sale Price ($)</label>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={formData.productPrice}
                        onChange={e => setFormData(prev => ({ ...prev, productPrice: e.target.value }))}
                      />
                    </div>
                    {formData.productPrice && (
                      <p className="text-xs text-gray-500 mt-1">
                        Buyer pays: <strong>${(parseFloat(formData.productPrice) * 1.1).toFixed(2)}</strong> (includes 10% platform fee)
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Questions */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Step 3 — Survey Questions (10)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">
                Each question has 4 answer choices (A, B, C, D). Users will select one answer per question.
              </p>
              {formData.questions.map((q, i) => (
                <div key={i}>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Question {i + 1}</label>
                  <Input
                    placeholder={`Enter question ${i + 1}...`}
                    value={q}
                    onChange={e => updateQuestion(i, e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['A', 'B', 'C', 'D'].map(letter => (
                      <Input
                        key={letter}
                        placeholder={`Answer ${letter}`}
                        className="text-xs"
                        value={formData.answerOptions[i]?.[letter.toLowerCase()] || ''}
                        onChange={e => {
                          const updated = [...formData.answerOptions];
                          if (!updated[i]) updated[i] = { a: '', b: '', c: '', d: '' };
                          updated[i][letter.toLowerCase()] = e.target.value;
                          setFormData(prev => ({ ...prev, answerOptions: updated }));
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-bold text-gray-900">Ready to Submit?</p>
                  <p className="text-sm text-gray-500">
                    {surveyType === 'type1'
                      ? `Estimated cost: $${(Math.max(formData.sampleSize, 100) * 4).toLocaleString()}`
                      : 'Cost: $4.00 per sale generated + 10% fee on sale price'}
                  </p>
                </div>
                <Button
                  onClick={handleSubmit}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8"
                >
                  Submit Survey for Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}