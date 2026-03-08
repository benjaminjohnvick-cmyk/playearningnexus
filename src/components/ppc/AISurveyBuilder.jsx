import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, CheckCircle2, Edit3 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AISurveyBuilder({ surveyType, productName, onQuestionsGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState(null);
  const [generatedTitle, setGeneratedTitle] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Please describe what your survey should cover'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiSurveyGenerator', {
        prompt, surveyType, productName
      });
      if (res.data?.success) {
        setGeneratedQuestions(res.data.questions);
        setGeneratedTitle(res.data.title);
        toast.success('✨ AI generated 10 questions! Review and edit below.');
      } else {
        toast.error('AI generation failed. Please try again.');
      }
    } catch (e) {
      toast.error('AI service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (i, field, value) => {
    const updated = [...generatedQuestions];
    updated[i] = { ...updated[i], [field]: value };
    setGeneratedQuestions(updated);
  };

  const handleAccept = () => {
    onQuestionsGenerated(generatedQuestions, generatedTitle);
    toast.success('Questions applied to your survey!');
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Survey Generator
          <Badge className="bg-purple-100 text-purple-700 text-xs">One-Click</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">Describe your survey topic and AI will write all 10 questions with A/B/C/D answers instantly.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Describe your survey</label>
          <div className="flex gap-2">
            <textarea
              rows={3}
              className="flex-1 border-2 border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder={surveyType === 'product_listing'
                ? `e.g. "I'm selling wireless earbuds. I want to know if users prefer noise cancellation, battery life, comfort, or price when buying earbuds."`
                : `e.g. "I want to research consumer attitudes toward electric vehicles — cost concerns, range anxiety, environmental motivation, and brand preference."`
              }
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating 10 Questions…</>
            : <><Sparkles className="w-4 h-4 mr-2" /> Generate Survey with AI</>
          }
        </Button>

        {generatedQuestions && (
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Generated: "{generatedTitle}"
              </p>
              <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {generatedQuestions.map((q, i) => (
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
              onClick={handleAccept}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Use These Questions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}