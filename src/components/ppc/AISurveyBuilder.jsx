import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, CheckCircle2, Edit3, Save, AlertCircle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AISurveyBuilder({ surveyType, productName, onQuestionsGenerated, onSurveyCreated }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [generatedSurvey, setGeneratedSurvey] = useState(null); // { survey_id, title, description, questions }

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Please describe what your survey should cover'); return; }
    setLoading(true);
    setError(null);
    setGeneratedSurvey(null);
    try {
      const res = await base44.functions.invoke('generateAISurvey', { prompt });
      if (res.data?.success) {
        setGeneratedSurvey({
          survey_id: res.data.survey_id,
          title: res.data.title,
          description: res.data.description,
          questions: res.data.questions
        });
        toast.success('✨ Survey generated! Review and edit below, then save.');
      } else {
        setError('AI generation failed. Please try again.');
      }
    } catch (e) {
      setError('AI service unavailable. Please try again.');
    } finally {
      setLoading(false);
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
        questions: generatedSurvey.questions
      });
      toast.success('🎉 Survey saved successfully!');
      if (onSurveyCreated) onSurveyCreated(generatedSurvey.survey_id);
      if (onQuestionsGenerated) onQuestionsGenerated(generatedSurvey.questions, generatedSurvey.title);
    } catch (e) {
      toast.error('Failed to save survey. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Survey Generator
          <Badge className="bg-purple-100 text-purple-700 text-xs">Powered by AI</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Describe your research goal in plain English and AI will instantly build a complete 10-question survey.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Prompt Input */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">What do you want to research?</label>
          <textarea
            rows={3}
            className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder={`e.g. "I want to understand how likely people are to switch from gas motorcycles to electric motorcycles"`}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Survey…</>
            : <><Sparkles className="w-4 h-4 mr-2" /> Generate Survey with AI</>
          }
        </Button>

        {/* Generated Survey Preview & Editor */}
        {generatedSurvey && (
          <div className="space-y-3 mt-2">
            {/* Title & Description editable */}
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

            {/* Questions */}
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> 10 Questions — click any field to edit
              </p>
              <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
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

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Survey…</>
                : <><Save className="w-4 h-4 mr-2" /> Save Survey</>
              }
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}