import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, Copy } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SurveyABTestBuilder({ userSurveys = [] }) {
  const [step, setStep] = useState('details'); // details, select, confirm
  const [testTitle, setTestTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [sampleSize, setSampleSize] = useState(100);
  const [surveyAId, setSurveyAId] = useState('');
  const [surveyBId, setSurveyBId] = useState('');

  const { mutate: createTest, isPending } = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      // Create A/B test record
      const test = await base44.entities.SurveyABTest.create({
        creator_user_id: user.id,
        survey_a_id: surveyAId,
        survey_b_id: surveyBId,
        title: testTitle,
        hypothesis,
        sample_size_each: sampleSize,
        status: 'active'
      });

      // Activate both surveys
      await Promise.all([
        base44.entities.PPCSurvey.update(surveyAId, { status: 'active' }),
        base44.entities.PPCSurvey.update(surveyBId, { status: 'active' })
      ]);

      return test;
    },
    onSuccess: () => {
      toast.success('A/B test created and surveys activated!');
      setTestTitle('');
      setHypothesis('');
      setSampleSize(100);
      setSurveyAId('');
      setSurveyBId('');
      setStep('details');
    },
    onError: (error) => {
      toast.error('Failed to create A/B test');
      console.error(error);
    }
  });

  const validDetails = testTitle && hypothesis && sampleSize > 0;
  const validSelection = surveyAId && surveyBId && surveyAId !== surveyBId;
  const draftSurveys = userSurveys.filter(s => s.status === 'draft');

  return (
    <div className="space-y-4">
      {step === 'details' && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Create A/B Test
            </CardTitle>
            <CardDescription>Compare two survey versions to optimize design</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">Test Title</label>
              <Input
                placeholder="e.g., 'Question Wording Test'"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">Hypothesis</label>
              <Textarea
                placeholder="What are you testing? E.g., 'Shorter questions will improve completion rates'"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">Sample Size Per Variant</label>
              <Input
                type="number"
                min="10"
                max="10000"
                step="10"
                value={sampleSize}
                onChange={(e) => setSampleSize(parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 100-500 per variant for statistically significant results</p>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Zap className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                Each variant must be a separate draft survey. You'll run them simultaneously and compare metrics.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setStep('select')}
              disabled={!validDetails || draftSurveys.length < 2}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700"
            >
              Next: Select Surveys
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'select' && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-purple-600" />
              Select Survey Variants
            </CardTitle>
            <CardDescription>Choose which draft surveys to compare</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">Variant A</label>
                <Select value={surveyAId} onValueChange={setSurveyAId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select survey..." />
                  </SelectTrigger>
                  <SelectContent>
                    {draftSurveys.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">Variant B</label>
                <Select value={surveyBId} onValueChange={setSurveyBId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select survey..." />
                  </SelectTrigger>
                  <SelectContent>
                    {draftSurveys.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {surveyAId && surveyBId && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900 font-medium">✓ Ready to test:</p>
                <p className="text-xs text-green-800 mt-1">
                  {draftSurveys.find(s => s.id === surveyAId)?.title} vs {draftSurveys.find(s => s.id === surveyBId)?.title}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('details')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!validSelection}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700"
              >
                Review & Launch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'confirm' && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardHeader>
            <CardTitle>Confirm A/B Test</CardTitle>
            <CardDescription>Review settings before launching</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 p-3 bg-white rounded border border-gray-200">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Test Title</p>
                <p className="text-sm font-medium text-gray-900">{testTitle}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Hypothesis</p>
                <p className="text-sm text-gray-700">{hypothesis}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Variant A</p>
                  <p className="text-sm text-gray-900">{draftSurveys.find(s => s.id === surveyAId)?.title}</p>
                </div>
                <div className="flex items-center justify-center text-gray-400">vs</div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Variant B</p>
                  <p className="text-sm text-gray-900">{draftSurveys.find(s => s.id === surveyBId)?.title}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Sample Size</p>
                <p className="text-sm text-gray-900">{sampleSize} responses per variant</p>
              </div>
            </div>

            <Alert className="bg-yellow-50 border-yellow-200">
              <Zap className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-900">
                Both surveys will be activated immediately and run simultaneously until one reaches the target sample size with statistically significant results.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => createTest()}
                disabled={isPending}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Launch Test
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}