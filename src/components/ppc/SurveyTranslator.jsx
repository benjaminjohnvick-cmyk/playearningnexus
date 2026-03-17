import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, CheckCircle2, Download, Save } from 'lucide-react';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'pt', label: '🇧🇷 Portuguese' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'ko', label: '🇰🇷 Korean' },
  { code: 'zh', label: '🇨🇳 Chinese (Simplified)' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'nl', label: '🇳🇱 Dutch' },
  { code: 'pl', label: '🇵🇱 Polish' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'sv', label: '🇸🇪 Swedish' },
];

export default function SurveyTranslator({ user }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translatedSurvey, setTranslatedSurvey] = useState(null);

  const { data: surveys = [] } = useQuery({
    queryKey: ['my-surveys-translate', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }),
    enabled: !!user?.id
  });

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);
  const selectedLang = LANGUAGES.find(l => l.code === targetLanguage);

  const handleTranslate = async () => {
    if (!selectedSurveyId || !targetLanguage) {
      toast.error('Please select a survey and target language');
      return;
    }
    setTranslating(true);
    setTranslatedSurvey(null);
    try {
      const res = await base44.functions.invoke('translateSurvey', {
        survey_id: selectedSurveyId,
        target_language: targetLanguage,
        target_language_label: selectedLang?.label,
        title: selectedSurvey.title,
        description: selectedSurvey.product_description,
        questions: selectedSurvey.questions,
      });
      if (res.data?.success) {
        setTranslatedSurvey(res.data.translated);
        toast.success(`✅ Translated to ${selectedLang?.label}!`);
      } else {
        toast.error('Translation failed. Please try again.');
      }
    } catch {
      toast.error('Translation service unavailable');
    } finally {
      setTranslating(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!translatedSurvey) return;
    setSaving(true);
    try {
      // Save as a linked translated copy
      await base44.entities.PPCSurvey.create({
        creator_user_id: user.id,
        survey_type: selectedSurvey.survey_type,
        title: translatedSurvey.title,
        product_description: translatedSurvey.description,
        questions: translatedSurvey.questions,
        status: 'active',
        ai_generated: true,
        ai_prompt: `Translated from: "${selectedSurvey.title}" to ${selectedLang?.label}`,
        tier: selectedSurvey.tier || 1,
        sample_size: selectedSurvey.sample_size || 100,
        cost_per_response: 4,
        min_spend: 400,
        responses_count: 0,
        total_spent: 0,
        budget_remaining: 0,
        language_code: targetLanguage,
        parent_survey_id: selectedSurveyId,
      });

      // Also embed the translation inline on the parent survey for respondent language routing
      const existingLangs = selectedSurvey.available_languages || ['en'];
      const existingTranslations = selectedSurvey.translations || {};
      await base44.entities.PPCSurvey.update(selectedSurveyId, {
        translations: {
          ...existingTranslations,
          [targetLanguage]: {
            title: translatedSurvey.title,
            description: translatedSurvey.description,
            questions: translatedSurvey.questions,
          },
        },
        available_languages: existingLangs.includes(targetLanguage)
          ? existingLangs
          : [...existingLangs, targetLanguage],
      });

      toast.success(`✅ Saved as active ${selectedLang?.label} survey + linked to original for auto-routing!`);
    } catch {
      toast.error('Failed to save translated survey');
    } finally {
      setSaving(false);
    }
  };

  const updateTranslated = (qi, field, value) => {
    setTranslatedSurvey(prev => {
      const questions = [...prev.questions];
      questions[qi] = { ...questions[qi], [field]: value };
      return { ...prev, questions };
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Globe className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-900">AI Survey Translator</p>
            <p className="text-sm text-green-700">Translate your AI-generated surveys into 15+ languages. The AI preserves contextual meaning, tone, and cultural nuance — not just word-for-word translation.</p>
          </div>
        </CardContent>
      </Card>

      {/* Selectors */}
      <Card className="border-0 shadow-lg">
        <CardHeader><CardTitle>Select Survey & Target Language</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Survey to Translate</label>
            <Select value={selectedSurveyId} onValueChange={v => { setSelectedSurveyId(v); setTranslatedSurvey(null); }}>
              <SelectTrigger className="border-2">
                <SelectValue placeholder="Choose a survey…" />
              </SelectTrigger>
              <SelectContent>
                {surveys.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Target Language</label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setTargetLanguage(lang.code); setTranslatedSurvey(null); }}
                  className={`px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    targetLanguage === lang.code
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 hover:border-green-300 text-gray-600'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {selectedSurvey && targetLanguage && (
            <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              Translating: <strong>"{selectedSurvey.title}"</strong> →{' '}
              <strong>{selectedLang?.label}</strong> ({selectedSurvey.questions?.length || 0} questions + {selectedSurvey.questions?.reduce((s, q) => s + 4, 0)} answer options)
            </div>
          )}

          <Button
            onClick={handleTranslate}
            disabled={translating || !selectedSurveyId || !targetLanguage}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white"
          >
            {translating
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Translating with AI…</>
              : <><Globe className="w-4 h-4 mr-2" />Translate Survey</>}
          </Button>
        </CardContent>
      </Card>

      {/* Translated Preview */}
      {translatedSurvey && (
        <Card className="border-2 border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Translated: {selectedLang?.label}
              </CardTitle>
              <Button onClick={handleSaveAsNew} disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white">
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                  : <><Save className="w-4 h-4 mr-2" />Save as New Survey Draft</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title & Description */}
            <div className="bg-green-50 rounded-xl p-3 space-y-2">
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Title</p>
                <input
                  className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-green-400 py-0.5 mt-0.5"
                  value={translatedSurvey.title}
                  onChange={e => setTranslatedSurvey(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              {translatedSurvey.description && (
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Description</p>
                  <input
                    className="w-full text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-green-300 py-0.5 mt-0.5"
                    value={translatedSurvey.description}
                    onChange={e => setTranslatedSurvey(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Questions */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {translatedSurvey.questions.map((q, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-green-600 bg-green-100 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <input
                      className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-green-400 pb-0.5"
                      value={q.question}
                      onChange={e => updateTranslated(i, 'question', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 pl-7">
                    {['a', 'b', 'c', 'd'].map(opt => (
                      <div key={opt} className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase w-4">{opt}.</span>
                        <input
                          className="flex-1 text-xs text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-green-300"
                          value={q[`option_${opt}`] || ''}
                          onChange={e => updateTranslated(i, `option_${opt}`, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}