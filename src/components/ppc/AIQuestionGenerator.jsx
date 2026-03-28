import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useToast } from "@/components/ui/use-toast";

export default function AIQuestionGenerator({ surveyTitle, surveyType, onQuestionsGenerated }) {
  const [topic, setTopic] = useState(surveyTitle || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    if (!topic.trim()) { toast({ title: 'Enter a topic first', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert survey designer. Generate exactly 10 multiple-choice survey questions for the following topic.

Topic: "${topic}"
Survey Type: ${surveyType === 'product_listing' ? 'Product listing / market research' : 'Data collection research'}

Requirements:
- Each question must be clear, unbiased, and professional
- Each question must have exactly 4 options: A, B, C, D
- Questions should progress logically (awareness → attitude → intent)
- Options should be mutually exclusive and collectively exhaustive

Return ONLY valid JSON with this exact structure.`,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  option_a: { type: 'string' },
                  option_b: { type: 'string' },
                  option_c: { type: 'string' },
                  option_d: { type: 'string' }
                }
              }
            }
          }
        }
      });

      if (result?.questions?.length > 0) {
        onQuestionsGenerated(result.questions.slice(0, 10), topic);
        toast({ title: `✨ ${result.questions.length} questions generated!` });
      } else {
        toast({ title: 'No questions returned', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'AI generation failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <span className="font-semibold text-purple-900 text-sm">AI Question Generator</span>
        <Badge className="bg-purple-100 text-purple-700 text-xs">Instant</Badge>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Describe your survey topic…"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="border-2 border-purple-200 bg-white flex-1"
          onKeyPress={e => e.key === 'Enter' && generate()}
        />
        <Button
          onClick={generate}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shrink-0"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
            : <><RefreshCw className="w-4 h-4 mr-1.5" /> Generate 10 Questions</>}
        </Button>
      </div>
      <p className="text-xs text-purple-600">AI will instantly create 10 professional A/B/C/D questions — you can edit them after.</p>
    </div>
  );
}