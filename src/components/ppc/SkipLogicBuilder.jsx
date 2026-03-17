import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GitBranch, ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Skip Logic Rule schema:
 * {
 *   id: string,
 *   source_question_index: number,   // 0-based index of the question
 *   selected_option: 'a'|'b'|'c'|'d',
 *   action: 'skip_to' | 'end_survey',
 *   target_question_index: number    // only if action === 'skip_to'
 * }
 */

const OPTION_LABELS = { a: 'A', b: 'B', c: 'C', d: 'D' };

function RuleRow({ rule, questions, onChange, onDelete }) {
  const sourceQ = questions[rule.source_question_index];
  const optionText = sourceQ?.[`option_${rule.selected_option}`];

  return (
    <div className="flex items-center gap-2 flex-wrap p-3 bg-white rounded-xl border border-purple-100 shadow-sm">
      {/* Source question */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400 text-xs font-semibold">IF</span>
        <Select
          value={String(rule.source_question_index)}
          onValueChange={v => onChange({ ...rule, source_question_index: parseInt(v), selected_option: 'a' })}
        >
          <SelectTrigger className="h-8 text-xs w-32 border-purple-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {questions.map((q, i) => (
              <SelectItem key={i} value={String(i)} disabled={!q.question?.trim()}>
                Q{i + 1}{q.question ? `: ${q.question.slice(0, 20)}…` : ' (empty)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Option selected */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400 text-xs font-semibold">answer is</span>
        <Select
          value={rule.selected_option}
          onValueChange={v => onChange({ ...rule, selected_option: v })}
        >
          <SelectTrigger className="h-8 text-xs w-24 border-purple-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['a', 'b', 'c', 'd'].map(opt => {
              const text = questions[rule.source_question_index]?.[`option_${opt}`];
              return (
                <SelectItem key={opt} value={opt} disabled={!text}>
                  {OPTION_LABELS[opt]}{text ? `: ${text.slice(0, 18)}` : ' (empty)'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />

      {/* Action */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400 text-xs font-semibold">THEN</span>
        <Select
          value={rule.action}
          onValueChange={v => onChange({ ...rule, action: v, target_question_index: v === 'end_survey' ? undefined : rule.target_question_index })}
        >
          <SelectTrigger className="h-8 text-xs w-28 border-purple-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip_to">Skip to</SelectItem>
            <SelectItem value="end_survey">End survey</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Target question (only if skip_to) */}
      {rule.action === 'skip_to' && (
        <Select
          value={rule.target_question_index !== undefined ? String(rule.target_question_index) : ''}
          onValueChange={v => onChange({ ...rule, target_question_index: parseInt(v) })}
        >
          <SelectTrigger className="h-8 text-xs w-32 border-purple-200">
            <SelectValue placeholder="Select question…" />
          </SelectTrigger>
          <SelectContent>
            {questions.map((q, i) => {
              if (i <= rule.source_question_index) return null;
              return (
                <SelectItem key={i} value={String(i)} disabled={!q.question?.trim()}>
                  Q{i + 1}{q.question ? `: ${q.question.slice(0, 18)}…` : ' (empty)'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 ml-auto flex-shrink-0" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function SkipLogicBuilder({ questions, skipLogic, onChange }) {
  const rules = skipLogic || [];

  const addRule = () => {
    const firstValidQ = questions.findIndex(q => q.question?.trim());
    if (firstValidQ === -1) { toast.error('Add some questions first'); return; }
    const newRule = {
      id: `rule_${Date.now()}`,
      source_question_index: firstValidQ,
      selected_option: 'a',
      action: 'skip_to',
      target_question_index: undefined,
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id, updated) => {
    onChange(rules.map(r => r.id === id ? { ...updated, id } : r));
  };

  const deleteRule = (id) => {
    onChange(rules.filter(r => r.id !== id));
  };

  // Build a visual flow summary
  const filledQuestions = questions.filter(q => q.question?.trim());

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-600" />
          Skip Logic & Branching
          <Badge className="bg-purple-100 text-purple-700 ml-1">{rules.length} rule{rules.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">Define conditional paths — respondents are routed based on their answers instead of always following a linear flow.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Rules are evaluated in order. The <strong>first matching rule</strong> for each answer wins. Questions skipped over are not shown to the respondent.</span>
        </div>

        {/* Flow preview */}
        {filledQuestions.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {questions.map((q, i) => {
              if (!q.question?.trim()) return null;
              const hasRule = rules.some(r => r.source_question_index === i);
              return (
                <React.Fragment key={i}>
                  <div className={`px-2 py-1 rounded-lg text-xs font-semibold border-2 ${hasRule ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    Q{i + 1}
                    {hasRule && <GitBranch className="w-2.5 h-2.5 inline ml-1 text-purple-500" />}
                  </div>
                  {i < questions.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                </React.Fragment>
              );
            })}
            <div className="px-2 py-1 rounded-lg text-xs font-semibold border-2 border-green-300 bg-green-50 text-green-700 ml-1">END</div>
          </div>
        )}

        {/* Rules list */}
        {rules.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            No skip logic rules yet. Click "Add Rule" to create branching paths.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div key={rule.id} className="flex items-start gap-2">
                <span className="text-xs font-bold text-gray-400 mt-3.5 w-5 flex-shrink-0">#{idx + 1}</span>
                <div className="flex-1">
                  <RuleRow
                    rule={rule}
                    questions={questions}
                    onChange={updated => updateRule(rule.id, updated)}
                    onDelete={() => deleteRule(rule.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button onClick={addRule} variant="outline" className="w-full border-dashed border-purple-300 text-purple-700 hover:bg-purple-50">
          <Plus className="w-4 h-4 mr-2" /> Add Rule
        </Button>
      </CardContent>
    </Card>
  );
}