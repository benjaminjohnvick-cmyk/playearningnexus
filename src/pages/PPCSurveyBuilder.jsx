import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Wand2, Users, DollarSign, AlertCircle, Check, Trash2, Plus } from 'lucide-react';
import SurveyPricingTiers from '@/components/ppc/SurveyPricingTiers';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MIN_QUESTIONS = 5;
const MIN_SAMPLE_SIZE = 400;
const COST_PER_QUESTION = 0.10;

export default function PPCSurveyBuilder() {
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sampleSize, setSampleSize] = useState(400);
  const [productName, setProductName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [customBudget, setCustomBudget] = useState('');
  const [activeTab, setActiveTab] = useState('builder');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const generateSurvey = async () => {
    if (!prompt.trim()) {
      toast.error('Enter a survey topic or prompt');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('aiSurveyGenerator', { prompt, min_questions: MIN_QUESTIONS });
      if (response.data.questions && response.data.questions.length >= MIN_QUESTIONS) {
        setSurvey(response.data);
        setActiveTab('review');
        toast.success('Survey generated! Review and adjust as needed.');
      } else {
        toast.error('Failed to generate sufficient questions. Try a more specific prompt.');
      }
    } catch (err) {
      toast.error('Error generating survey');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (idx, field, value) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q)
    }));
  };

  const deleteQuestion = (idx) => {
    if (survey.questions.length <= MIN_QUESTIONS) {
      toast.error(`Minimum ${MIN_QUESTIONS} questions required`);
      return;
    }
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx)
    }));
  };

  const addQuestion = () => {
    setSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '', answers: ['', ''], type: 'multiple_choice' }]
    }));
  };

  const publishSurvey = async () => {
    if (survey.questions.length < MIN_QUESTIONS) {
      toast.error(`Minimum ${MIN_QUESTIONS} questions required`);
      return;
    }
    if (sampleSize < MIN_SAMPLE_SIZE) {
      toast.error(`Minimum sample size is ${MIN_SAMPLE_SIZE}`);
      return;
    }

    const totalCost = survey.questions.length * COST_PER_QUESTION;

    try {
      await base44.functions.invoke('createPPCSurvey', {
        questions: survey.questions,
        sample_size: sampleSize,
        total_cost: totalCost,
        title: survey.title,
        product_name: productName || undefined,
        product_url: productUrl || undefined
      });
      toast.success('Survey published to PPC Marketplace!');
      setSurvey(null);
      setPrompt('');
      setSampleSize(400);
      setProductName('');
      setProductUrl('');
    } catch (err) {
      toast.error('Failed to publish survey');
      console.error(err);
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  const totalCost = survey ? survey.questions.length * COST_PER_QUESTION : 0;
  const isValid = survey && survey.questions.length >= MIN_QUESTIONS && sampleSize >= MIN_SAMPLE_SIZE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 mb-2 flex items-center gap-3">
            <FileText className="w-10 h-10 text-blue-600" /> PPC Survey Builder
          </h1>
          <p className="text-gray-600">Create surveys with AI and earn money from respondents</p>
        </div>

        <SurveyPricingTiers />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="builder">
              <Wand2 className="w-4 h-4 mr-2" /> Create Survey
            </TabsTrigger>
            <TabsTrigger value="review" disabled={!survey}>
              <Check className="w-4 h-4 mr-2" /> Review & Publish
            </TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="builder" className="space-y-6">
            <Card className="p-8 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 1: Describe Your Survey</h2>
              <p className="text-sm text-gray-600 mb-4">
                Enter a detailed topic or prompt. AI will generate survey questions automatically.
              </p>
              <Textarea
                placeholder="e.g., 'Create a survey about mobile phone purchasing habits, including price points, brand preferences, and features users care about'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-32 mb-4"
              />
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Product Name (Optional)</label>
                  <Input
                    placeholder="e.g., iPhone 15"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Product Website URL (Optional)</label>
                  <Input
                    placeholder="https://example.com"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">📊 Add a product link to automatically track website visits and get AI insights!</p>
              <Button
                onClick={generateSurvey}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 w-full py-6 text-lg font-bold"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" /> Generate Survey with AI
                  </>
                )}
              </Button>
            </Card>

            {/* Info Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4 bg-white border-l-4 border-green-500">
                <p className="text-xs text-gray-600 font-semibold">MINIMUM QUESTIONS</p>
                <p className="text-2xl font-black text-green-600 mt-1">{MIN_QUESTIONS}</p>
              </Card>
              <Card className="p-4 bg-white border-l-4 border-blue-500">
                <p className="text-xs text-gray-600 font-semibold">MINIMUM SAMPLE SIZE</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{MIN_SAMPLE_SIZE}</p>
              </Card>
              <Card className="p-4 bg-white border-l-4 border-purple-500">
                <p className="text-xs text-gray-600 font-semibold">COST PER QUESTION</p>
                <p className="text-2xl font-black text-purple-600 mt-1">${COST_PER_QUESTION.toFixed(2)}</p>
              </Card>
            </div>
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review" className="space-y-6">
            {survey && (
              <>
                {/* Survey Details */}
                <Card className="p-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Survey Details</h2>
                  <Input
                    placeholder="Survey Title"
                    value={survey.title || ''}
                    onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                    className="mb-4 font-bold text-lg"
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Sample Size</label>
                      <Input
                        type="number"
                        min={MIN_SAMPLE_SIZE}
                        value={sampleSize}
                        onChange={(e) => setSampleSize(Math.max(MIN_SAMPLE_SIZE, parseInt(e.target.value) || 0))}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Minimum {MIN_SAMPLE_SIZE} responses</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Total Budget</label>
                      <div className="mt-1 p-3 bg-white rounded-lg border font-bold text-lg text-green-600">
                        ${totalCost.toFixed(2)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{survey.questions.length} questions × ${COST_PER_QUESTION}</p>
                    </div>
                  </div>
                </Card>

                {/* Validation */}
                <Card className="p-4 bg-white">
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 ${survey.questions.length >= MIN_QUESTIONS ? 'text-green-600' : 'text-red-600'}`}>
                      {survey.questions.length >= MIN_QUESTIONS ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      <span className="font-semibold">{survey.questions.length} questions ({MIN_QUESTIONS} required)</span>
                    </div>
                    <div className={`flex items-center gap-2 ${sampleSize >= MIN_SAMPLE_SIZE ? 'text-green-600' : 'text-red-600'}`}>
                      {sampleSize >= MIN_SAMPLE_SIZE ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      <span className="font-semibold">Sample size: {sampleSize} ({MIN_SAMPLE_SIZE} minimum)</span>
                    </div>
                  </div>
                </Card>

                {/* Questions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">Survey Questions</h3>
                    <Button onClick={addQuestion} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Question
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {survey.questions.map((q, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                        <Card className="p-5 border-l-4 border-blue-500">
                          <div className="flex items-start justify-between mb-3">
                            <Badge className="bg-blue-100 text-blue-700">Q{idx + 1}</Badge>
                            {survey.questions.length > MIN_QUESTIONS && (
                              <Button
                                onClick={() => deleteQuestion(idx)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <Input
                            placeholder="Question text"
                            value={q.question}
                            onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                            className="mb-3 font-semibold"
                          />
                          <select
                            value={q.type || 'multiple_choice'}
                            onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="text">Short Text</option>
                            <option value="rating">Rating Scale</option>
                          </select>
                          {(q.type === 'multiple_choice' || !q.type) && (
                            <div className="space-y-2">
                              {q.answers?.map((ans, aidx) => (
                                <Input
                                  key={aidx}
                                  placeholder={`Option ${aidx + 1}`}
                                  value={ans}
                                  onChange={(e) => {
                                    const newAnswers = [...q.answers];
                                    newAnswers[aidx] = e.target.value;
                                    updateQuestion(idx, 'answers', newAnswers);
                                  }}
                                  className="text-sm"
                                />
                              ))}
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Publish */}
                <div className="flex gap-4">
                  <Button
                    onClick={() => setActiveTab('builder')}
                    variant="outline"
                    className="flex-1"
                  >
                    Back to Builder
                  </Button>
                  <Button
                    onClick={publishSurvey}
                    disabled={!isValid}
                    className={`flex-1 py-6 text-lg font-bold ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}
                  >
                    <DollarSign className="w-5 h-5 mr-2" /> Publish Survey (${totalCost.toFixed(2)})
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}