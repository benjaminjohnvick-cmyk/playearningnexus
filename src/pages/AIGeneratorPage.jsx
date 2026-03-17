import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AISurveyGeneratorWizard from '@/components/surveys/AISurveyGeneratorWizard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AIGeneratorPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleSurveyGenerated = async (generatedSurvey) => {
    try {
      setIsCreating(true);
      const user = await base44.auth.me();

      // Create survey from generated content
      const newSurvey = await base44.entities.PPCSurvey.create({
        creator_user_id: user.id,
        survey_type: 'data_collection',
        title: generatedSurvey.survey_title,
        product_description: generatedSurvey.survey_description,
        questions: generatedSurvey.questions.map(q => ({
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d
        })),
        ai_generated: true,
        ai_prompt: `Goal: ${generatedSurvey.survey_goal}; Audience: ${generatedSurvey.target_audience}`,
        status: 'draft',
        sample_size: 100,
        cost_per_response: 4,
        min_spend: 400
      });

      toast.success('Survey created from AI generation!');
      navigate(`/SurveyAnalytics?survey_id=${newSurvey.id}`);
    } catch (error) {
      toast.error('Failed to create survey');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Survey Generator
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Describe your survey goals and target audience, and let our AI instantly generate optimized questions, response formats, and question ordering to maximize completion rates.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <AISurveyGeneratorWizard onSurveyGenerated={handleSurveyGenerated} />
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-12">
          <Card className="p-4 border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
            <p className="text-sm font-bold text-blue-900 mb-2">✨ AI Optimized</p>
            <p className="text-xs text-gray-600">Questions are crafted to reduce bias and maximize engagement</p>
          </Card>
          <Card className="p-4 border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
            <p className="text-sm font-bold text-green-900 mb-2">⚡ Instant Setup</p>
            <p className="text-xs text-gray-600">No more blank page syndrome—AI handles question creation</p>
          </Card>
          <Card className="p-4 border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
            <p className="text-sm font-bold text-purple-900 mb-2">📊 Better Results</p>
            <p className="text-xs text-gray-600">AI orders questions for higher completion rates</p>
          </Card>
        </div>
      </div>
    </div>
  );
}