import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Bot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['platform_ui', 'game_mechanic', 'reward_system', 'survey_flow', 'dashboard', 'onboarding', 'store'];

export default function FeatureSurveyForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    feature_name: '',
    category: 'platform_ui',
    survey_question: '',
    options: ['', '', ''],
  });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (i) => setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  const setOption = (i, v) => setForm(f => { const opts = [...f.options]; opts[i] = v; return { ...f, options: opts }; });

  const aiGenerate = async () => {
    if (!form.feature_name) { toast.error('Enter a feature name first'); return; }
    setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `For a GamerGain platform feature called "${form.feature_name}" (category: ${form.category}), generate a great survey question and 4 distinct answer options to understand what users want.
Return JSON: { "question": "string", "options": ["string","string","string","string"] }`,
        response_json_schema: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setForm(f => ({ ...f, survey_question: result.question || f.survey_question, options: result.options || f.options }));
      toast.success('AI generated question and options!');
    } catch { toast.error('AI generation failed'); }
    setGenerating(false);
  };

  const handleSave = async () => {
    const validOpts = form.options.filter(o => o.trim());
    if (!form.feature_name || !form.survey_question || validOpts.length < 2) {
      toast.error('Fill in feature name, question, and at least 2 options');
      return;
    }
    setSaving(true);
    try {
      const record = await base44.entities.FeatureMockup.create({
        feature_name: form.feature_name,
        category: form.category,
        survey_question: form.survey_question,
        survey_responses: validOpts.map(o => ({ option: o, votes: 0, pct: 0 })),
        phase: 'survey_phase',
        total_survey_votes: 0,
      });
      toast.success('Feature survey created! Users can now vote.');
      onCreated?.(record);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">Feature Name</p>
          <Input placeholder="e.g. Dashboard Earnings Widget" value={form.feature_name} onChange={e => setForm(f => ({ ...f, feature_name: e.target.value }))} className="text-sm" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">Category</p>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-600">Survey Question</p>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-indigo-600 gap-1" onClick={aiGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
            AI Generate
          </Button>
        </div>
        <Textarea placeholder="What would you prefer for this feature?" value={form.survey_question} onChange={e => setForm(f => ({ ...f, survey_question: e.target.value }))} className="text-sm h-14" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-600">Answer Options</p>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addOption}><Plus className="w-3 h-3" /> Add</Button>
        </div>
        <div className="space-y-2">
          {form.options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder={`Option ${i + 1}`} value={opt} onChange={e => setOption(i, e.target.value)} className="text-sm h-8 flex-1" />
              {form.options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Launch Survey'}
        </Button>
      </div>
    </div>
  );
}