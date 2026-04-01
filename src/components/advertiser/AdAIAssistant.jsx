import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bot, Send, Loader2, Lightbulb, TrendingUp, HelpCircle, ChevronRight } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Why did my CTR drop recently?',
  'Which of my ads has the best ROI?',
  'Suggest ways to improve my survey completion rate',
  'What bid should I set to reach Premium tier?',
  'How do I reduce fraud risk on my campaigns?',
  'What creative style works best for my category?',
  'Should I increase or decrease my budget?',
  'Which ad should I pause first if budget is low?',
];

function Message({ msg }) {
  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {msg.role === 'assistant' && (
        <div className="w-7 h-7 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        msg.role === 'user'
          ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/30'
          : 'bg-gray-800 text-gray-200 border border-gray-700'
      }`}>
        {msg.content}
        {msg.suggestions && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Follow-up questions:</p>
            {msg.suggestions.map((s, i) => (
              <button key={i} onClick={msg.onSuggestion?.(s)}
                className="block text-left text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 group">
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /> {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdAIAssistant({ ads }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey! I'm your AI Campaign Assistant 👋\n\nI have full access to your ${ads.length} ad campaign(s) and their performance data. Ask me anything — I can explain CTR drops, suggest improvements, analyze ROI, or help you outperform competitors.\n\nWhat would you like to know?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildAdContext = () => {
    if (ads.length === 0) return 'The user has no active ad campaigns.';
    return ads.map(ad => {
      const ctr = ad.total_clicks > 0 ? ((ad.surveys_completed / ad.total_clicks) * 100).toFixed(1) : 0;
      const roi = ad.total_spent > 0 ? ((ad.surveys_completed * ad.bid_amount - ad.total_spent) / ad.total_spent * 100).toFixed(0) : 0;
      return `- "${ad.brand_name}" | Status: ${ad.status} | Tier: ${ad.grid_tier} | Bid: $${ad.bid_amount}/survey | Clicks: ${ad.total_clicks || 0} | Surveys completed: ${ad.surveys_completed || 0} | CTR: ${ctr}% | Spent: $${(ad.total_spent || 0).toFixed(2)} | Budget left: $${(ad.budget_limit - (ad.total_spent || 0)).toFixed(2)} | Tagline: "${ad.tagline || 'none'}"`;
    }).join('\n');
  };

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert AI advertising assistant for GamerGain, a gaming platform's ad grid.

ADVERTISER'S CAMPAIGN DATA:
${buildAdContext()}

CONVERSATION HISTORY:
${history}

USER QUESTION: ${userMsg}

Respond helpfully and specifically using the actual campaign data provided. Be conversational but data-driven.
- Reference specific ad names, metrics, and numbers from their data
- Give concrete, actionable advice
- Keep response under 200 words
- Also provide 2-3 short follow-up question suggestions relevant to what you just answered

Respond in JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            follow_up_suggestions: { type: 'array', items: { type: 'string' } },
            performance_tip: { type: 'string' },
          }
        }
      });

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer + (result.performance_tip ? `\n\n💡 Tip: ${result.performance_tip}` : ''),
          suggestions: result.follow_up_suggestions,
          onSuggestion: (s) => () => send(s),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-gray-400 text-sm">Analyzing your campaigns...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Suggested questions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
              <button key={i} onClick={() => send(q)}
                className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-2.5 py-1.5 rounded-lg transition-all text-left">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your campaigns... (Enter to send)"
          rows={2}
          className="flex-1 bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()}
          className="bg-purple-600 hover:bg-purple-500 text-white self-end h-10 w-10 p-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}