import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['male', 'female', 'non_binary'];
const EMPLOYMENT = ['employed_full', 'employed_part', 'self_employed', 'student', 'unemployed', 'retired'];
const EDUCATION = ['high_school', 'some_college', 'bachelors', 'masters', 'phd'];
const INCOME = ['under_25k', '25k_50k', '50k_75k', '75k_100k', 'over_100k'];
const INTERESTS = [
  'Gaming', 'Technology', 'Finance', 'Health & Fitness', 'Travel', 'Food & Cooking',
  'Fashion', 'Sports', 'Music', 'Movies & TV', 'Books', 'Automotive', 'Parenting', 'Business'
];
const SKILLS = [
  'Software Development', 'Marketing', 'Graphic Design', 'Data Analysis', 'Writing',
  'Teaching', 'Healthcare', 'Finance & Accounting', 'Legal', 'Engineering'
];

function MultiSelect({ label, options, selected = [], onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? selected.filter(s => s !== opt) : [...selected, opt])}
              className={`text-xs px-2 py-0.5 rounded-full border transition-all ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SurveyTargetingFilter({ targeting = {}, onChange }) {
  const [expanded, setExpanded] = useState(false);

  const update = (key, value) => onChange({ ...targeting, [key]: value });

  const activeCount = [
    targeting.age_ranges?.length,
    targeting.genders?.length,
    targeting.employment_statuses?.length,
    targeting.education_levels?.length,
    targeting.income_ranges?.length,
    targeting.required_interests?.length,
    targeting.required_skills?.length,
  ].filter(v => v > 0).length;

  return (
    <Card className="border-2 border-purple-100">
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded(v => !v)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" />
            Audience Targeting
            {activeCount > 0 && <Badge className="bg-purple-100 text-purple-700">{activeCount} filters</Badge>}
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        <p className="text-xs text-gray-400 text-left">Target respondents by demographics, interests & verified skills for more relevant responses.</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <MultiSelect label="Age Ranges" options={AGE_RANGES} selected={targeting.age_ranges || []} onChange={v => update('age_ranges', v)} />
          <MultiSelect label="Gender" options={GENDERS} selected={targeting.genders || []} onChange={v => update('genders', v)} />
          <MultiSelect label="Employment Status" options={EMPLOYMENT} selected={targeting.employment_statuses || []} onChange={v => update('employment_statuses', v)} />
          <MultiSelect label="Education Level" options={EDUCATION} selected={targeting.education_levels || []} onChange={v => update('education_levels', v)} />
          <MultiSelect label="Household Income" options={INCOME} selected={targeting.income_ranges || []} onChange={v => update('income_ranges', v)} />
          <MultiSelect label="Required Interests" options={INTERESTS} selected={targeting.required_interests || []} onChange={v => update('required_interests', v)} />
          <MultiSelect label="Required Skills" options={SKILLS} selected={targeting.required_skills || []} onChange={v => update('required_skills', v)} />

          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700 px-0" onClick={() => onChange({})}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear all filters
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}