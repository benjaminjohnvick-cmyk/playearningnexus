import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Mic, MicOff, BarChart2, TrendingUp, Target, Zap, ChevronRight, RefreshCw, Download, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const COMPLEX_QUESTIONS = [
  { label: 'CTR drop analysis', q: 'Why did my CTR drop recently? Break it down by ad and suggest fixes.' },
  { label: 'Top 3 ROI compare', q: 'Compare the ROI of my top 3 performing ads with specific numbers and reasons.' },
  { label: '18-24 segment', q: 'How are my ads performing in the 18-24 gaming segment vs. other demographics?' },
  { label: 'Budget realloc', q: 'Which ads should I kill and where should I reallocate that budget?' },
  { label: 'Fraud risk', q: 'Which of my campaigns shows the highest fraud risk signals and why?' },
  { label: 'Conversion funnel', q: 'Where is my survey completion funnel dropping off most?' },
  { label: '30-day forecast', q: 'Forecast my spend and survey completions for the next 30 days based on current trends.' },
  { label: 'Bid strategy', q: 'Should I increase my bids on any ads? Give me a specific recommendation with numbers.' },
];

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function ChatMessage({ msg, onFollowUp }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} items-end`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0 mb-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[88%] space-y-2`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/30 rounded-br-sm'
            : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm'
        }`}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({children}) => <p className="mb-2 last:mb-0 text-gray-200">{children}</p>,
                  strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  li: ({children}) => <li className="text-gray-300">{children}</li>,
                  h3: ({children}) => <h3 className="text-white font-bold text-sm mb-1 mt-2">{children}</h3>,
                  code: ({children}) => <code className="bg-gray-900 text-yellow-300 px-1.5 py-0.5 rounded text-xs">{children}</code>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Data points inline */}
        {msg.dataPoints && msg.dataPoints.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.dataPoints.map((dp, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <span className="text-gray-500 text-[10px] font-bold">{dp.label}</span>
                <span className={`text-xs font-black ${dp.good ? 'text-green-400' : 'text-red-400'}`}>{dp.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up suggestions */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider pl-1">Ask a follow-up:</p>
            {msg.suggestions.map((s, i) => (
              <button key={i} onClick={() => onFollowUp(s)}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors group text-left w-full">
                <ChevronRight className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildContext(ads) {
  if (!ads.length) return 'No ad campaigns exist yet.';
  const summary = ads.map(ad => {
    const ctr = ad.total_clicks > 0 ? ((ad.surveys_completed / ad.total_clicks) * 100).toFixed(2) : '0';
    const roi = ad.total_spent > 0 ? ((ad.surveys_completed * (ad.bid_amount || 0.4)) / ad.total_spent).toFixed(2) : '0';
    const completion = ad.surveys_started > 0 ? ((ad.surveys_completed / ad.surveys_started) * 100).toFixed(1) : '0';
    const budgetLeft = ((ad.budget_limit || 0) - (ad.total_spent || 0)).toFixed(2);
    const burnRate = ad.total_spent > 0 && ad.total_clicks > 0 ? ((ad.total_spent / ad.total_clicks) * 1000).toFixed(2) : 'N/A';
    return `Campaign: "${ad.brand_name}"
  - Status: ${ad.status} | Tier: ${ad.grid_tier || 'Standard'} | Bid: $${ad.bid_amount}/survey
  - Clicks: ${ad.total_clicks || 0} | Surveys started: ${ad.surveys_started || 0} | Completed: ${ad.surveys_completed || 0}
  - CTR: ${ctr}% | ROI: ${roi}x | Completion rate: ${completion}%
  - Total spent: $${(ad.total_spent || 0).toFixed(2)} | Budget remaining: $${budgetLeft}
  - Cost per 1000 clicks: $${burnRate}
  - Tagline: "${ad.tagline || 'none'}" | Smart bidding: ${ad.smart_bidding ? 'on' : 'off'}
  - Submitted: ${ad.submitted_at ? new Date(ad.submitted_at).toLocaleDateString() : 'unknown'}`;
  }).join('\n\n');

  const totals = ads.reduce((acc, ad) => ({
    clicks: acc.clicks + (ad.total_clicks || 0),
    completed: acc.completed + (ad.surveys_completed || 0),
    spent: acc.spent + (ad.total_spent || 0),
    budget: acc.budget + (ad.budget_limit || 0),
  }), { clicks: 0, completed: 0, spent: 0, budget: 0 });

  return `PORTFOLIO OVERVIEW: ${ads.length} campaigns | ${totals.clicks} total clicks | ${totals.completed} completions | $${totals.spent.toFixed(2)} total spend | $${(totals.budget - totals.spent).toFixed(2)} remaining budget

INDIVIDUAL CAMPAIGNS:
${summary}`;
}

export default function AdCampaignChat({ ads }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `# Campaign Intelligence Assistant\n\nI have full access to your **${ads.length} campaign${ads.length !== 1 ? 's' : ''}** and all their performance metrics.\n\nAsk me complex questions like:\n- *"Why did CTR drop yesterday in the 18-24 segment?"*\n- *"Compare ROI of my top 3 ads"*\n- *"Which ad should I scale up and why?"*\n\nI'll analyze your real data and give you specific, actionable answers.`,
    suggestions: [],
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported in this browser.'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = messages.slice(-8).map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content.slice(0, 400)}`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `You are an expert advertising intelligence analyst for GamerGain Ad Grid. You have access to real campaign data and must give SPECIFIC, DATA-DRIVEN answers with actual numbers from the campaigns.

REAL CAMPAIGN DATA:
${buildContext(ads)}

CONVERSATION HISTORY:
${history}

USER QUESTION: ${q}

Instructions:
- Reference specific campaign names and real metrics from the data above
- Use markdown formatting: **bold** for important numbers, bullet lists for comparisons
- Give concrete actionable recommendations with specific numbers
- If asked about segments the data doesn't have, explain what data you do have
- Keep response focused and under 300 words
- Extract 3-5 key data points as metrics cards
- Suggest 2-3 sharp follow-up questions

Respond in JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          data_points: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                good: { type: 'boolean' },
              }
            }
          },
          follow_up_suggestions: { type: 'array', items: { type: 'string' } },
        }
      }
    });

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: result.answer,
      dataPoints: result.data_points || [],
      suggestions: result.follow_up_suggestions || [],
    }]);
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const exportChat = () => {
    const txt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'campaign-analysis.txt'; a.click();
  };

  return (
    <div className="flex flex-col bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden" style={{ height: '70vh', minHeight: 500 }}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-black text-sm leading-none">Campaign Intelligence</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{ads.length} campaigns in context</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportChat} className="text-gray-500 hover:text-gray-300 transition-colors" title="Export chat">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMessages([messages[0]])} className="text-gray-500 hover:text-gray-300 transition-colors" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">Live Data</Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} onFollowUp={send} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-2">Complex questions I can answer:</p>
          <div className="flex flex-wrap gap-1.5">
            {COMPLEX_QUESTIONS.map((item, i) => (
              <button key={i} onClick={() => send(item.q)}
                className="text-[11px] border border-gray-700 text-gray-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/5 px-2.5 py-1.5 rounded-lg transition-all text-left">
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex gap-2 items-end flex-shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={listening ? '🎤 Listening...' : 'Ask complex questions about your campaigns... (Shift+Enter for new line)'}
          rows={2}
          className={`flex-1 bg-gray-900 border text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none transition-colors ${listening ? 'border-red-500/50 placeholder-red-400' : 'border-gray-700 focus:border-purple-500/50'}`}
        />
        <div className="flex flex-col gap-1.5">
          <button
            onClick={listening ? stopVoice : startVoice}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${listening ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
          >
            {listening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
          </button>
          <Button onClick={() => send()} disabled={loading || !input.trim()}
            className="w-9 h-9 p-0 bg-purple-600 hover:bg-purple-500 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}