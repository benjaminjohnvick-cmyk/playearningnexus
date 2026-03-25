import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Code2, Globe, BarChart2, Zap, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';

const WIDGET_API = 'https://base44app.com/api/functions/surveyWidget';

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
}

function EmbedCodeBlock({ surveyId, surveyTitle }) {
  const scriptTag = `<script src="${WIDGET_API}?path=widget&survey_id=${surveyId}" async></script>`;
  const divTag = `<div data-gg-survey="${surveyId}"></div>`;
  const fullEmbed = `<!-- GamerGain Survey: ${surveyTitle} -->\n<div data-gg-survey="${surveyId}"></div>\n<script src="${WIDGET_API}?path=widget&survey_id=${surveyId}" async></script>`;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono text-green-400 relative">
        <pre className="whitespace-pre-wrap break-all">{fullEmbed}</pre>
        <div className="absolute top-3 right-3">
          <CopyButton text={fullEmbed} label="Copy Code" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="font-semibold text-blue-800 mb-1">1. Add the container div</p>
          <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">{divTag}</code>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="font-semibold text-purple-800 mb-1">2. Add the script tag</p>
          <code className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded block break-all">{scriptTag}</code>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Place the <code className="bg-amber-100 px-1 rounded">{'<div>'}</code> wherever you want the survey to appear on your page. Both tags must be present.</span>
      </div>
    </div>
  );
}

function SurveyEmbedCard({ survey }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  }[survey.status] || 'bg-gray-100 text-gray-600';

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{survey.title}</CardTitle>
            <p className="text-xs text-gray-500 mt-1">{survey.questions?.length || 0} questions · {survey.responses_count || 0} responses</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColor}>{survey.status}</Badge>
            {survey.status !== 'active' && (
              <span className="text-xs text-red-500">Activate survey to enable embedding</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setExpanded(!expanded)}
            disabled={survey.status !== 'active'}
          >
            <Code2 className="w-4 h-4" /> {expanded ? 'Hide' : 'Get Embed Code'}
          </Button>
          <a href={`/PPCMarketplace`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="ghost" className="gap-2 text-gray-500">
              <ExternalLink className="w-4 h-4" /> View in Marketplace
            </Button>
          </a>
        </div>
        {expanded && <EmbedCodeBlock surveyId={survey.id} surveyTitle={survey.title} />}
      </CardContent>
    </Card>
  );
}

export default function SurveyEmbedManager() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['my-embed-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }),
    enabled: !!user,
  });

  const activeSurveys = surveys.filter(s => s.status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Globe className="w-4 h-4" /> SURVEY EMBED MANAGER
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
            Embed Surveys on Any Website
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Copy a single code snippet and paste it into any website. Responses are tracked directly back to your GamerGain account.
          </p>
        </div>

        {/* How It Works */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Code2, title: '1. Copy Snippet', desc: 'Get the embed code for any active PPC survey you own.', color: 'bg-blue-50 border-blue-200' },
            { icon: Globe, title: '2. Paste on Your Site', desc: 'Drop the code into any webpage — WordPress, Webflow, plain HTML, anywhere.', color: 'bg-purple-50 border-purple-200' },
            { icon: BarChart2, title: '3. Track Responses', desc: 'All completions sync back to your GamerGain dashboard in real time.', color: 'bg-green-50 border-green-200' },
          ].map(({ icon: StepIcon, title, desc, color }) => (
            <div key={title} className={`border rounded-xl p-4 ${color}`}>
              <StepIcon className="w-6 h-6 mb-2 text-gray-700" />
              <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>

        {/* Stats Strip */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Surveys', value: surveys.length },
              { label: 'Embeddable (Active)', value: activeSurveys.length },
              { label: 'Total Embed Responses', value: surveys.reduce((a, s) => a + (s.responses_count || 0), 0) },
            ].map(({ label, value }) => (
              <Card key={label} className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Survey List */}
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active Surveys ({activeSurveys.length})</TabsTrigger>
            <TabsTrigger value="all">All Surveys ({surveys.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-4">
            {isLoading && <p className="text-center text-gray-400 py-8">Loading surveys...</p>}
            {!isLoading && activeSurveys.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No active surveys yet</p>
                <p className="text-sm mt-1">Activate a survey in the PPC Marketplace to enable embedding.</p>
              </div>
            )}
            {activeSurveys.map(s => <SurveyEmbedCard key={s.id} survey={s} />)}
          </TabsContent>

          <TabsContent value="all" className="mt-4 space-y-4">
            {isLoading && <p className="text-center text-gray-400 py-8">Loading surveys...</p>}
            {surveys.map(s => <SurveyEmbedCard key={s.id} survey={s} />)}
          </TabsContent>
        </Tabs>

        {/* Subscription Upsell */}
        <Card className="border-2 border-dashed border-purple-300 bg-purple-50">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-purple-900 text-lg mb-1">🚀 White-Label Embedding</h3>
                <p className="text-sm text-purple-700">
                  Want to offer embedded surveys as a service to your own clients? Upgrade to a <strong>Publisher Plan</strong> to get branded widgets, custom domains, and subscription-based survey access for your customers.
                </p>
              </div>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shrink-0">
                Learn About Publisher Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}