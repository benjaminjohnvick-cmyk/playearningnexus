import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, GripVertical, Trash2, CheckSquare, Star, Type, ToggleLeft,
  Save, Send, Eye, ChevronDown, ChevronUp, Loader2, FileText, GitBranch, Sparkles
} from 'lucide-react';

const QUESTION_TYPES = [
  { type: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare, color: 'bg-blue-100 text-blue-700' },
  { type: 'rating',          label: 'Rating Scale',   icon: Star,         color: 'bg-yellow-100 text-yellow-700' },
  { type: 'text',            label: 'Open Text',      icon: Type,         color: 'bg-purple-100 text-purple-700' },
  { type: 'yes_no',          label: 'Yes / No',       icon: ToggleLeft,   color: 'bg-green-100 text-green-700' },
];

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function newQuestion(type) {
  return {
    id: genId(),
    type,
    question: '',
    options: type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C'] : [],
    required: true,
    rating_max: 5,
  };
}

// ── Question Editor ────────────────────────────────────────────────────────────
function QuestionEditor({ q, index, onUpdate, onDelete, totalQuestions }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = QUESTION_TYPES.find(t => t.type === q.type);
  const Icon = cfg?.icon || FileText;

  const updateOption = (i, val) => {
    const opts = [...(q.options || [])];
    opts[i] = val;
    onUpdate({ ...q, options: opts });
  };

  const addOption = () => onUpdate({ ...q, options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
  const removeOption = (i) => onUpdate({ ...q, options: q.options.filter((_, idx) => idx !== i) });

  return (
    <div className={`bg-white border-2 rounded-xl transition-all ${expanded ? 'border-indigo-200 shadow-md' : 'border-gray-100 shadow-sm'}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-bold text-gray-400 w-5">{index + 1}</span>
        <Badge className={`text-xs ${cfg?.color || 'bg-gray-100 text-gray-700'}`}>
          <Icon className="w-3 h-3 mr-1" />{cfg?.label}
        </Badge>
        <p className="flex-1 text-sm font-medium text-gray-700 truncate">{q.question || 'Untitled question'}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={e => { e.stopPropagation(); onDelete(q.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <Input
            placeholder="Enter your question…"
            value={q.question}
            onChange={e => onUpdate({ ...q, question: e.target.value })}
            className="font-medium border-2 focus:border-indigo-400"
          />

          {/* Multiple choice options */}
          {q.type === 'multiple_choice' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">Answer Options</p>
              {(q.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  <Input value={opt} onChange={e => updateOption(i, e.target.value)} className="flex-1 h-8 text-sm" />
                  {q.options.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                      onClick={() => removeOption(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} className="w-full mt-1 border-dashed text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Option
              </Button>
            </div>
          )}

          {/* Rating scale */}
          {q.type === 'rating' && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">Max rating:</p>
              <Select value={String(q.rating_max || 5)} onValueChange={v => onUpdate({ ...q, rating_max: Number(v) })}>
                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10].map(n => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                {Array.from({ length: q.rating_max || 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
            </div>
          )}

          {/* Yes/No preview */}
          {q.type === 'yes_no' && (
            <div className="flex gap-3">
              <div className="px-4 py-1.5 border-2 border-green-300 rounded-lg text-sm font-medium text-green-700 bg-green-50">Yes</div>
              <div className="px-4 py-1.5 border-2 border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50">No</div>
            </div>
          )}

          {/* Text preview */}
          {q.type === 'text' && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-xs text-gray-400 italic">
              Open text response field will appear here
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id={`req-${q.id}`} checked={q.required}
              onChange={e => onUpdate({ ...q, required: e.target.checked })} className="rounded" />
            <label htmlFor={`req-${q.id}`} className="text-xs text-gray-500">Required</label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branch Logic Editor ────────────────────────────────────────────────────────
function BranchLogicEditor({ questions, branchLogic, onChange }) {
  const mcQuestions = questions.filter(q => q.type === 'multiple_choice' || q.type === 'yes_no');

  const addRule = () => onChange([...branchLogic, { source_question_id: '', condition_value: '', action: 'skip_to', target_question_id: '' }]);
  const removeRule = (i) => onChange(branchLogic.filter((_, idx) => idx !== i));
  const updateRule = (i, patch) => {
    const updated = [...branchLogic];
    updated[i] = { ...updated[i], ...patch };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Define conditional logic — e.g. if a user selects a specific answer, skip to a later question or end the survey.</p>
      {branchLogic.map((rule, i) => {
        const srcQ = questions.find(q => q.id === rule.source_question_id);
        const availableValues = srcQ?.type === 'yes_no' ? ['Yes', 'No'] : (srcQ?.options || []);
        return (
          <Card key={i} className="border border-indigo-100 bg-indigo-50/30">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">IF question</span>
                <Select value={rule.source_question_id} onValueChange={v => updateRule(i, { source_question_id: v, condition_value: '' })}>
                  <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Choose question…" /></SelectTrigger>
                  <SelectContent>
                    {mcQuestions.map(q => (
                      <SelectItem key={q.id} value={q.id}>{q.question.slice(0, 35) || `Q${questions.indexOf(q) + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs font-semibold text-gray-500">= </span>
                <Select value={rule.condition_value} onValueChange={v => updateRule(i, { condition_value: v })}>
                  <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Value…" /></SelectTrigger>
                  <SelectContent>
                    {availableValues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs font-semibold text-gray-500">THEN</span>
                <Select value={rule.action} onValueChange={v => updateRule(i, { action: v })}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip_to">Skip to</SelectItem>
                    <SelectItem value="end_survey">End survey</SelectItem>
                  </SelectContent>
                </Select>
                {rule.action === 'skip_to' && (
                  <Select value={rule.target_question_id} onValueChange={v => updateRule(i, { target_question_id: v })}>
                    <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Target question…" /></SelectTrigger>
                    <SelectContent>
                      {questions.filter(q => q.id !== rule.source_question_id).map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.question.slice(0, 35) || `Q${questions.indexOf(q) + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 ml-auto" onClick={() => removeRule(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="outline" size="sm" onClick={addRule} className="w-full border-dashed gap-1.5 text-xs">
        <Plus className="w-3 h-3" /> Add Branch Rule
      </Button>
    </div>
  );
}

// ── My Templates Panel ─────────────────────────────────────────────────────────
function MyTemplates({ user, onLoad }) {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['my-templates', user?.id],
    queryFn: () => base44.entities.SurveyTemplate.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.SurveyTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries(['my-templates']); toast.success('Template deleted.'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;

  if (templates.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>No templates yet. Build your first survey!</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {templates.map(t => (
        <Card key={t.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{t.title}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span>{t.questions?.length || 0} questions</span>
                <span>•</span>
                <span>{t.estimated_time_minutes}m est.</span>
                <span>•</span>
                <Badge className={t.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                  {t.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => onLoad(t)}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600"
                onClick={() => deleteMut.mutate(t.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SurveyTemplateBuilder() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('builder');
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [estTime, setEstTime] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [branchLogic, setBranchLogic] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const saveMut = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.SurveyTemplate.update(editingId, data)
      : base44.entities.SurveyTemplate.create(data),
    onSuccess: (saved) => {
      setEditingId(saved.id);
      qc.invalidateQueries(['my-templates']);
      toast.success(editingId ? 'Template updated!' : 'Template saved!');
    },
  });

  const publishMut = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.SurveyTemplate.update(editingId, { ...data, status: 'published' })
      : base44.entities.SurveyTemplate.create({ ...data, status: 'published' }),
    onSuccess: () => {
      qc.invalidateQueries(['my-templates']);
      toast.success('Template published!');
    },
  });

  const getPayload = () => ({
    creator_user_id: user.id,
    title: title || 'Untitled Survey',
    description,
    category,
    estimated_time_minutes: estTime,
    questions,
    branch_logic: branchLogic,
  });

  const loadTemplate = (t) => {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description || '');
    setCategory(t.category || '');
    setEstTime(t.estimated_time_minutes || 5);
    setQuestions(t.questions || []);
    setBranchLogic(t.branch_logic || []);
    setTab('builder');
  };

  const resetBuilder = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setEstTime(5);
    setQuestions([]);
    setBranchLogic([]);
  };

  const addQuestion = (type) => {
    setQuestions(prev => [...prev, newQuestion(type)]);
  };

  const updateQuestion = (updated) => {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
  };

  const deleteQuestion = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    setBranchLogic(prev => prev.filter(r => r.source_question_id !== id && r.target_question_id !== id));
  };

  const generateAIQuestions = async () => {
    if (!title) { toast.error('Add a survey title first'); return; }
    setAiGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateAISurvey', {
        prompt: `Generate 5 survey questions for: "${title}". Category: ${category || 'general'}. Include a mix of multiple_choice, rating, and text questions.`,
        survey_title: title,
      });
      const generated = (data?.questions || []).map(q => ({
        id: genId(),
        type: q.type || 'multiple_choice',
        question: q.question || q.text || '',
        options: q.options || (q.type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C'] : []),
        required: true,
        rating_max: q.rating_max || 5,
      }));
      if (generated.length > 0) {
        setQuestions(prev => [...prev, ...generated]);
        toast.success(`Added ${generated.length} AI-generated questions!`);
      }
    } catch {
      toast.error('AI generation failed. Try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(questions);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setQuestions(items);
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Survey Template Builder</h1>
              <p className="text-sm text-gray-500">Drag & drop to design reusable survey templates</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetBuilder}>+ New Template</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 bg-white shadow-sm border">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="logic"><GitBranch className="w-3.5 h-3.5 mr-1" />Branch Logic</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="w-3.5 h-3.5 mr-1" />Preview</TabsTrigger>
            <TabsTrigger value="templates">My Templates</TabsTrigger>
          </TabsList>

          {/* ── BUILDER TAB ── */}
          <TabsContent value="builder">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left: settings + question type palette */}
              <div className="space-y-4">
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Survey Settings</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Title *</label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Survey title…" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Description</label>
                      <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Category</label>
                      <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Health, Tech…" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Est. Time (min)</label>
                      <Input type="number" min={1} max={60} value={estTime}
                        onChange={e => setEstTime(Number(e.target.value))} className="border-2 w-24" />
                    </div>
                  </CardContent>
                </Card>

                {/* AI Generate */}
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 gap-2 text-sm"
                  onClick={generateAIQuestions}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiGenerating ? 'Generating…' : 'AI Generate Questions'}
                </Button>

                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Add Question</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {QUESTION_TYPES.map(qt => {
                      const Icon = qt.icon;
                      return (
                        <button key={qt.type} onClick={() => addQuestion(qt.type)}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left">
                          <Icon className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-medium text-gray-700">{qt.label}</span>
                          <Plus className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-2">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                    onClick={() => saveMut.mutate(getPayload())} disabled={saveMut.isPending}>
                    {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingId ? 'Update Draft' : 'Save as Draft'}
                  </Button>
                  <Button variant="outline" className="w-full gap-2 border-green-400 text-green-700 hover:bg-green-50"
                    onClick={() => publishMut.mutate(getPayload())} disabled={publishMut.isPending}>
                    {publishMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Publish Template
                  </Button>
                </div>
              </div>

              {/* Right: drag-and-drop question list */}
              <div className="lg:col-span-2">
                {questions.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-20 text-gray-400">
                    <FileText className="w-14 h-14 mb-4 opacity-20" />
                    <p className="font-medium">No questions yet</p>
                    <p className="text-sm mt-1">Click a question type on the left to get started</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="questions">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {questions.map((q, index) => (
                            <Draggable key={q.id} draggableId={q.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                  className={snapshot.isDragging ? 'opacity-80 scale-[1.01]' : ''}>
                                  <QuestionEditor
                                    q={q} index={index}
                                    onUpdate={updateQuestion}
                                    onDelete={deleteQuestion}
                                    totalQuestions={questions.length}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── BRANCH LOGIC TAB ── */}
          <TabsContent value="logic">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-600" /> Conditional Branching Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                {questions.length < 2 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Add at least 2 questions to define branching logic.</p>
                ) : (
                  <BranchLogicEditor questions={questions} branchLogic={branchLogic} onChange={setBranchLogic} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PREVIEW TAB ── */}
          <TabsContent value="preview">
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Mobile preview — exactly as respondents will see it
              </p>
              {/* Phone shell */}
              <div className="relative mx-auto" style={{ width: 375 }}>
                <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                  {/* Status bar */}
                  <div className="bg-gray-900 rounded-t-[2rem] px-4 py-2 flex justify-between items-center">
                    <span className="text-white text-xs font-medium">9:41</span>
                    <div className="w-20 h-5 bg-gray-800 rounded-full" />
                    <div className="flex gap-1 items-center">
                      <div className="w-3 h-2 bg-white rounded-sm opacity-80" />
                      <span className="text-white text-xs">●●●</span>
                    </div>
                  </div>
                  {/* Screen content */}
                  <div className="bg-white rounded-[1.75rem] overflow-hidden" style={{ minHeight: 580 }}>
                    {/* Survey header */}
                    <div className="bg-indigo-600 px-5 pt-5 pb-4">
                      <p className="text-white font-bold text-base">{title || 'Untitled Survey'}</p>
                      {description && <p className="text-indigo-200 text-xs mt-1">{description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-indigo-400 rounded-full">
                          <div className="h-1 bg-white rounded-full w-1/3" />
                        </div>
                        <span className="text-indigo-200 text-xs">{questions.length}q · {estTime}m</span>
                      </div>
                    </div>
                    {/* Questions */}
                    <div className="px-5 py-4 space-y-5 overflow-y-auto" style={{ maxHeight: 480 }}>
                      {questions.length === 0 ? (
                        <div className="text-center py-12 text-gray-300">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Add questions to preview</p>
                        </div>
                      ) : questions.map((q, i) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm font-semibold text-gray-800 leading-snug">
                            {i + 1}. {q.question || 'Untitled question'}
                            {q.required && <span className="text-red-500 ml-0.5">*</span>}
                          </p>
                          {q.type === 'multiple_choice' && (
                            <div className="space-y-1.5">
                              {(q.options || []).map((opt, j) => (
                                <label key={j} className="flex items-center gap-2.5 p-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {q.type === 'rating' && (
                            <div className="flex gap-2 py-1">
                              {Array.from({ length: q.rating_max || 5 }).map((_, j) => (
                                <Star key={j} className="w-7 h-7 text-gray-200" />
                              ))}
                            </div>
                          )}
                          {q.type === 'yes_no' && (
                            <div className="flex gap-2">
                              <div className="flex-1 py-2.5 border-2 border-green-300 rounded-xl text-center text-sm font-semibold text-green-700 bg-green-50">Yes</div>
                              <div className="flex-1 py-2.5 border-2 border-red-300 rounded-xl text-center text-sm font-semibold text-red-700 bg-red-50">No</div>
                            </div>
                          )}
                          {q.type === 'text' && (
                            <div className="border-2 border-gray-200 rounded-xl p-3 text-xs text-gray-300 italic bg-gray-50">
                              Type your answer here…
                            </div>
                          )}
                        </div>
                      ))}
                      {questions.length > 0 && (
                        <button className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl text-sm mt-2">
                          Next →
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Home indicator */}
                  <div className="flex justify-center py-2">
                    <div className="w-24 h-1 bg-gray-600 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── MY TEMPLATES TAB ── */}
          <TabsContent value="templates">
            <MyTemplates user={user} onLoad={loadTemplate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}