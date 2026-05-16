import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function QuickSurveyBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(5);
  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState({
    title: '',
    description: '',
    category: 'general',
    price_per_response: 0.50,
    target_audience: 'all',
    estimated_time: '2-3 minutes'
  });

  const steps = [
    { num: 5, label: 'Title & Description', icon: '📝' },
    { num: 4, label: 'Survey Details', icon: '⚙️' },
    { num: 3, label: 'Pricing & Audience', icon: '💰' },
    { num: 2, label: 'Questions', icon: '❓' },
    { num: 1, label: 'Review & Launch', icon: '🚀' }
  ];

  const handleNext = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Create survey
      const response = await base44.functions.invoke('createPPCSurvey', {
        title: survey.title,
        description: survey.description,
        category: survey.category,
        price_per_response: survey.price_per_response,
        target_audience: survey.target_audience
      });

      // Log to learning system
      await base44.functions.invoke('aiFeatureLearningFramework', {
        feature_name: 'quick_survey_builder',
        feature_type: 'generation',
        input_data: survey,
        output_data: response.data,
        actual_outcome: 1,
        accuracy_score: 1.0,
        user_satisfaction: 0.9
      }).catch(() => null);

      toast.success('✅ Survey created successfully!');
      setTimeout(() => navigate('/PPCMarketplace'), 1500);
    } catch (e) {
      toast.error('Failed to create survey: ' + e.message);
      setLoading(false);
    }
  };

  const currentStep = steps.find(s => s.num === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 p-6 flex items-center justify-center">
      <Card className="w-full max-w-2xl border-2 border-indigo-200">
        {/* Progress */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Build Survey</h1>
            <Badge className="bg-white text-indigo-600 text-lg px-3 py-1">Step {step}</Badge>
          </div>
          <div className="flex gap-2">
            {steps.map(s => (
              <div
                key={s.num}
                className={`flex-1 h-1 rounded transition-all ${s.num <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        <CardContent className="pt-8 space-y-6">
          {/* Step Header */}
          <div className="text-center">
            <div className="text-5xl mb-2">{currentStep.icon}</div>
            <h2 className="text-2xl font-bold text-slate-900">{step}: {currentStep.label}</h2>
          </div>

          {/* Step 5: Title & Description */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Survey Title</label>
                <Input
                  placeholder="e.g., Gaming Preferences Survey"
                  value={survey.title}
                  onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="What is this survey about?"
                  value={survey.description}
                  onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                  className="h-24"
                />
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <Select value={survey.category} onValueChange={(val) => setSurvey({ ...survey, category: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gaming">Gaming</SelectItem>
                    <SelectItem value="product">Product Feedback</SelectItem>
                    <SelectItem value="brand">Brand Research</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Estimated Time: {survey.estimated_time}</label>
                <Select value={survey.estimated_time} onValueChange={(val) => setSurvey({ ...survey, estimated_time: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-2 minutes">1-2 minutes (Quick)</SelectItem>
                    <SelectItem value="2-3 minutes">2-3 minutes (Medium)</SelectItem>
                    <SelectItem value="5+ minutes">5+ minutes (Detailed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Price Per Response</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">$</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0.25"
                    max="10"
                    value={survey.price_per_response}
                    onChange={(e) => setSurvey({ ...survey, price_per_response: parseFloat(e.target.value) })}
                    className="text-2xl font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Target Audience</label>
                <Select value={survey.target_audience} onValueChange={(val) => setSurvey({ ...survey, target_audience: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="gamers">Gamers</SelectItem>
                    <SelectItem value="premium">Premium Members</SelectItem>
                    <SelectItem value="high_earners">High Earners</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Quick Questions */}
          {step === 2 && (
            <div className="space-y-4 text-center">
              <p className="text-slate-600 text-lg">
                🤖 Questions will be AI-generated based on your survey details. Continue to the next step!
              </p>
              <div className="p-4 bg-indigo-50 rounded border border-indigo-200">
                <p className="font-semibold">Survey Preview:</p>
                <p className="text-sm text-slate-700 mt-2">{survey.title}</p>
                <p className="text-xs text-slate-600 mt-1">{survey.description}</p>
              </div>
            </div>
          )}

          {/* Step 1: Review & Launch */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Ready to Launch!</span>
                </div>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>✓ Title: {survey.title}</li>
                  <li>✓ Price: ${survey.price_per_response}/response</li>
                  <li>✓ Category: {survey.category}</li>
                  <li>✓ Target: {survey.target_audience}</li>
                </ul>
              </div>
              <p className="text-sm text-slate-600 text-center">
                Click "Complete Survey" to launch and start collecting responses immediately!
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNext}
              disabled={loading || !survey.title || !survey.description}
              className="flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-blue-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {step === 1 ? 'Complete Survey' : `Next (${step - 1})`}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}