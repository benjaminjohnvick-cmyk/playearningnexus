import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AISurveyGeneratorWizard({ onSurveyGenerated }) {
  const [step, setStep] = useState('input'); // input | generating | preview
  const [surveyGoal, setSurveyGoal] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [generatedSurvey, setGeneratedSurvey] = useState(null);

  const { mutate: generate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateAISurvey', {
        survey_goal: surveyGoal,
        target_audience: targetAudience,
        num_questions: numQuestions
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedSurvey(data.survey);
        setStep('preview');
        toast.success('Survey generated!');
      }
    },
    onError: (error) => {
      toast.error('Failed to generate survey');
      console.error(error);
    }
  });

  const handleGenerate = () => {
    if (!surveyGoal.trim() || !targetAudience.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setStep('generating');
    generate();
  };

  if (step === 'input') {
    return (
      <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Survey Generator
          </CardTitle>
          <CardDescription>Let AI create optimized survey questions for you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">Survey Goal</label>
            <Textarea
              placeholder="e.g., 'Understand customer preferences for our new product launch' or 'Test messaging effectiveness for a spring campaign'"
              value={surveyGoal}
              onChange={(e) => setSurveyGoal(e.target.value)}
              className="h-20"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">Target Audience</label>
            <Textarea
              placeholder="e.g., 'Women ages 25-35, interested in fitness and wellness, active on social media'"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="h-20"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">Number of Questions</label>
            <Input
              type="number"
              min="3"
              max="15"
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isPending}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'generating') {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto text-purple-600 animate-spin" />
          <p className="text-gray-600">AI is crafting your perfect survey...</p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'preview' && generatedSurvey) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{generatedSurvey.survey_title}</CardTitle>
            <CardDescription>{generatedSurvey.survey_description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedSurvey.questions.map((q, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-2">{i + 1}. {q.question}</p>
                <div className="space-y-1 ml-4 text-sm text-gray-600">
                  <p>A) {q.option_a}</p>
                  <p>B) {q.option_b}</p>
                  <p>C) {q.option_c}</p>
                  <p>D) {q.option_d}</p>
                </div>
              </div>
            ))}

            {generatedSurvey.completion_tips && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-sm">
                  <p className="font-medium text-blue-900 mb-2">💡 Completion Tips:</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    {generatedSurvey.completion_tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep('input')}
            className="flex-1"
          >
            Regenerate
          </Button>
          <Button
            onClick={() => onSurveyGenerated(generatedSurvey)}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Use This Survey
          </Button>
        </div>
      </div>
    );
  }
}