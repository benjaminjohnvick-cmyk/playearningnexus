import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, MessageCircle, X } from 'lucide-react';

// Per-visit personalization: a warm greeting, custom recommendations, and an AI chatbot opener,
// all driven by the user's compiled AI profile + the evolving site model (userPersonalized).
export default function PersonalizedGreeting() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    base44.functions.invoke('userPersonalized', {})
      .then((res) => { if (alive) setData(res.data); })
      .catch(() => { /* silent */ });
    return () => { alive = false; };
  }, []);

  if (!data || dismissed) return null;

  return (
    <Card className="mb-4 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5" />
            <div>
              <div className="font-semibold text-zinc-900">{data.greeting}</div>
              <ul className="mt-1 space-y-0.5">
                {(data.recommendations || []).map((r, i) => (
                  <li key={i} className="text-sm text-zinc-600">• {r}</li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-sm font-medium text-white"
        >
          <MessageCircle className="w-4 h-4" /> {chatOpen ? 'Hide' : 'Chat'}
        </button>
        {chatOpen && (
          <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-3 text-sm text-zinc-700">
            {data.chat_opener}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
