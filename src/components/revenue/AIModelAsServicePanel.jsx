import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Bot, Zap, TrendingUp, Code, Play, CheckCircle2, BarChart2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const AI_MODELS = [
  {
    id: 'survey_gen', name: 'Survey Generator AI', icon: '📋',
    description: 'Generates high-converting surveys from a topic prompt. Used by 400+ businesses.',
    pricing: '$0.05/survey', monthly_calls: 8900, monthly_revenue: 445,
    example_output: '5-question survey about gaming habits with multiple choice options',
    endpoint: 'POST /api/ai/survey-generator'
  },
  {
    id: 'fraud_detect', name: 'Fraud Detection AI', icon: '🛡️',
    description: 'Real-time survey response fraud scoring. 94% accuracy.',
    pricing: '$0.01/score', monthly_calls: 52000, monthly_revenue: 520,
    example_output: 'fraud_score: 0.12 (low risk), signals: ["fast_completion"]',
    endpoint: 'POST /api/ai/fraud-score'
  },
  {
    id: 'churn_pred', name: 'Churn Predictor', icon: '📉',
    description: 'Predicts user churn probability based on behavioral signals.',
    pricing: '$0.02/prediction', monthly_calls: 12000, monthly_revenue: 240,
    example_output: 'churn_probability: 0.73, top_reason: "survey_drop_off"',
    endpoint: 'POST /api/ai/churn-predict'
  },
  {
    id: 'ad_copy', name: 'Ad Copy Generator', icon: '✍️',
    description: 'Generates high-CTR ad copy for gaming audiences. 3x industry average CTR.',
    pricing: '$0.03/generation', monthly_calls: 6700, monthly_revenue: 201,
    example_output: '"Level Up Your Brand — Reach 100K+ Gamers Today"',
    endpoint: 'POST /api/ai/ad-copy'
  },
  {
    id: 'match_engine', name: 'Influencer Matcher', icon: '🤝',
    description: 'AI matches brands to the best creator profiles in the platform.',
    pricing: '$1.00/match', monthly_calls: 89, monthly_revenue: 89,
    example_output: 'top_match: CreatorX (score: 94%), reason: "gaming niche + 50K followers"',
    endpoint: 'POST /api/ai/influencer-match'
  },
  {
    id: 'sentiment', name: 'Sentiment Analyzer', icon: '💬',
    description: 'Analyzes player reviews, survey responses, and social media for sentiment.',
    pricing: '$0.005/analysis', monthly_calls: 34000, monthly_revenue: 170,
    example_output: 'sentiment: positive (0.82), topics: ["gameplay", "rewards"]',
    endpoint: 'POST /api/ai/sentiment'
  },
];

export default function AIModelAsServicePanel({ user }) {
  const [testingModel, setTestingModel] = useState(null);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [running, setRunning] = useState(false);

  const totalRevenue = AI_MODELS.reduce((s, m) => s + m.monthly_revenue, 0);
  const totalCalls = AI_MODELS.reduce((s, m) => s + m.monthly_calls, 0);

  const handleTest = async (model) => {
    if (!testInput) { toast.error('Enter a test input first'); return; }
    setRunning(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the GamerGain "${model.name}" AI model. 
        Process this input: "${testInput}"
        Respond in the format shown by this example output: ${model.example_output}
        Keep the response concise and realistic.`
      });
      setTestOutput(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Models as a Service</h2>
          <p className="text-gray-500 text-sm">Proprietary AI models available via API — pay-per-call or subscription</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-violet-600">Monthly Calls</div>
            <div className="text-lg font-bold text-violet-700">{totalCalls.toLocaleString()}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-green-600">Monthly Revenue</div>
            <div className="text-lg font-bold text-green-700">${totalRevenue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AI_MODELS.map(model => (
          <Card key={model.id} className={`border-2 hover:shadow-lg transition-all ${testingModel?.id === model.id ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200 hover:border-violet-300'}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{model.icon}</span>
                  <div className="font-bold text-sm">{model.name}</div>
                </div>
                <Badge className="bg-violet-100 text-violet-800 text-xs font-bold">{model.pricing}</Badge>
              </div>
              <p className="text-xs text-gray-600">{model.description}</p>
              <div className="bg-gray-900 rounded p-2 text-xs font-mono text-green-400">
                {model.endpoint}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-center">
                <div className="bg-gray-50 rounded p-1.5"><div className="text-gray-400">Calls/mo</div><div className="font-bold">{model.monthly_calls.toLocaleString()}</div></div>
                <div className="bg-green-50 rounded p-1.5"><div className="text-gray-400">Revenue</div><div className="font-bold text-green-700">${model.monthly_revenue}</div></div>
              </div>
              <Button size="sm" className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-1 text-xs"
                onClick={() => { setTestingModel(model); setTestInput(''); setTestOutput(''); }}>
                <Play className="w-3 h-3" /> Test Live
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Tester */}
      {testingModel && (
        <Card className="border-2 border-violet-300 bg-violet-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" /> Live API Tester — {testingModel.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={`Enter test input for ${testingModel.name}...`}
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => handleTest(testingModel)} disabled={running} className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
                <Play className="w-3 h-3" /> {running ? 'Running...' : 'Run'}
              </Button>
              <Button variant="outline" onClick={() => setTestingModel(null)}>Close</Button>
            </div>
            {testOutput && (
              <div className="bg-gray-900 rounded-lg p-3 text-sm font-mono text-green-400 whitespace-pre-wrap">
                <div className="text-gray-500 text-xs mb-1">// Response</div>
                {testOutput}
              </div>
            )}
            <p className="text-xs text-gray-500">Cost: <strong>{testingModel.pricing}</strong> per API call</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}