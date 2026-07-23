import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, Check, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const WIDGET_API = `${import.meta.env.VITE_NEXUS_API_URL || ''}/functions/surveyWidget`; // self-hosted backend

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied!' });
      setTimeout(() => setCopied(false), 2000);
    }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

function SurveyEmbedRow({ survey }) {
  const [open, setOpen] = useState(false);
  const embedCode = `<div data-gg-survey="${survey.id}"></div>\n<script src="${WIDGET_API}?path=widget&survey_id=${survey.id}" async></script>`;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 bg-gray-50">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{survey.title}</p>
            <p className="text-xs text-gray-500">{survey.questions?.length || 0} questions · {survey.responses_count || 0} responses</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="gap-1 text-xs">
            <Code2 className="w-3.5 h-3.5" /> Embed
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3 bg-white border-t border-gray-100">
          <p className="text-xs text-gray-500">Paste this anywhere on your website to display this survey:</p>
          <div className="relative bg-gray-900 rounded-lg p-3">
            <pre className="text-xs text-green-400 whitespace-pre-wrap break-all pr-16">{embedCode}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={embedCode} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Works on WordPress, Webflow, Squarespace, or any plain HTML site. Responses sync back to your GamerGain dashboard automatically.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SurveyEmbedPanel({ user }) {
  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['my-active-surveys-embed', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id, status: 'active' }),
    enabled: !!user,
  });

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="w-5 h-5 text-blue-500" />
          Embed Your Surveys on External Websites
        </CardTitle>
        <p className="text-sm text-gray-500">
          Copy a snippet and paste it into any website. All responses are tracked back to your account.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-gray-400 text-center py-4">Loading your active surveys...</p>}

        {!isLoading && surveys.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <Code2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No active surveys to embed</p>
            <p className="text-xs mt-1">Publish and activate a survey above to get its embed code.</p>
          </div>
        )}

        {surveys.map(s => <SurveyEmbedRow key={s.id} survey={s} />)}
      </CardContent>
    </Card>
  );
}