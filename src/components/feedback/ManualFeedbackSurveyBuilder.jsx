import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, GripVertical, Type, ToggleLeft, Star, List, ChevronUp, ChevronDown,
  Save, Eye, Loader2, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const QUESTION_TYPES = [
  { value: 'rating',           label: '⭐ Rating (1–5)',       icon: Star },
  { value: 'multiple_choice',  label: '📋 Multiple Choice',    icon: List },
  { value: 'text',             label: '✍️ Open Text',          icon: Type },
  { value: 'yes_no',           label: '✅ Yes / No',           icon: ToggleLeft },
];

const FOCUS_AREA_OPTIONS = [
  'Survey Experience', 'Payout System', 'Gamification', 'Referral Program',
  'UI/UX Design', 'Performance', 'Customer Support', 'Notifications', 'Marketplace', 'Mobile App'
];

const DEFAULT_OPTIONS = { multiple_choice: ['Option A', 'Option B', 'Option C'], yes_no: ['Yes', 'No'] };

function QuestionCard({ q, index, total, onChange, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true);

  const updateField = (key, val) => onChange({ ...q, [key]: val });
  const updateOption = (i, val) => {
    const opts = [...(q.options || [])];
    opts[i] = val;
    onChange({ ...q, options: opts });
  };
  const addOption = () => onChange({ ...q, options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
  const removeOption = (i) => onChange({ ...q, options: q.options.filter((_, idx) => idx !== i) });

  const typeConfig = QUESTION_TYPES.find(t => t.value === q.type) || QUESTION_TYPES[0];

  return (
    <div className="bg-white border-2 border-gray-100 hover:border-blue-100 rounded-xl shadow-sm transition-all">
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</div>
        <p className="flex-1 text-sm font-medium text-gray-800 truncate">{q.question || 'Untitled question'}</p>
        <Badge variant="outline" className="text-xs hidden sm:flex">{typeConfig.label}</Badge>
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMove(index, -1); }} disabled={index === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMove(index, 1); }} disabled={index === total - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(index); }} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Question text</label>
            <Input
              value={q.question}
              onChange={e => updateField('question', e.target.value)}
              placeholder="Type your question here…"
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
              <Select value={q.type} onValueChange={val => onChange({ ...q, type: val, options: DEFAULT_OPTIONS[val] || [] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
              <Select value={q.category || ''} onValueChange={val => updateField('category', val)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {FOCUS_AREA_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(q.type === 'multiple_choice') && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Options</label>
              <div className="space-y-1.5">
                {(q.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    <Input value={opt} onChange={e => updateOption(i, e.target.value)} className="h-7 text-xs flex-1" />
                    <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={addOption} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1">
                  <Plus className="w-3 h-3" /> Add option
                </button>
              </div>
            </div>
          )}

          {q.type === 'rating' && (
            <p className="text-xs text-gray-400 bg-yellow-50 rounded px-2 py-1">⭐ Users will rate on a scale of 1–5</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManualFeedbackSurveyBuilder({ onSaved }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [questions, setQuestions] = useState([
    { id: '1', type: 'rating', question: 'How satisfied are you with the platform overall?', category: 'UI/UX Design', options: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const addQuestion = (type = 'rating') => {
    const id = Date.now().toString();
    setQuestions(prev => [...prev, {
      id, type, question: '', category: '', options: DEFAULT_OPTIONS[type] || []
    }]);
  };

  const updateQuestion = (index, updated) => {
    setQuestions(prev => prev.map((q, i) => i === index ? updated : q));
  };

  const deleteQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, direction) => {
    setQuestions(prev => {
      const next = [...prev];
      const swapIdx = index + direction;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  };

  const toggleFocusArea = (area) => {
    setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const handleSave = async (status = 'active') => {
    if (!questions.length) return toast.error('Add at least one question');
    setSaving(true);
    try {
      await base44.entities.DailyFeedbackSurvey.create({
        date,
        questions: questions.map(q => ({ id: q.id, question: q.question, type: q.type, options: q.options || [], category: q.category || '' })),
        focus_areas: focusAreas,
        status,
        total_responses: 0,
        ai_generated: false,
      });
      toast.success(status === 'active' ? 'Survey published!' : 'Survey saved as draft!');
      qc.invalidateQueries({ queryKey: ['feedback_surveys'] });
      if (onSaved) onSaved();
    } catch (e) {
      toast.error('Failed to save survey');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header inputs */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Survey Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Survey Title (optional)</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly UX Check-In" className="h-9" />
        </div>
      </div>

      {/* Focus areas */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-2">Focus Areas</label>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_AREA_OPTIONS.map(area => (
            <button
              key={area}
              onClick={() => toggleFocusArea(area)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${focusAreas.includes(area) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-500" />
            Questions ({questions.length})
          </p>
          <p className="text-xs text-gray-400">Drag to reorder · Click to expand</p>
        </div>
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i}
            total={questions.length}
            onChange={updated => updateQuestion(i, updated)}
            onDelete={deleteQuestion}
            onMove={moveQuestion}
          />
        ))}
      </div>

      {/* Add question buttons */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        {QUESTION_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => addQuestion(t.value)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-gray-500"
          >
            <Plus className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button onClick={() => handleSave('active')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Publish Survey
        </Button>
        <Button onClick={() => handleSave('generating')} disabled={saving} variant="outline">
          Save as Draft
        </Button>
      </div>
    </div>
  );
}