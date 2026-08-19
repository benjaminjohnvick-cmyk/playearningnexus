import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

// Floating AI assistant — a real back-and-forth chat grounded in the user's profile + site model
// (userAssistantChat). Helps the user earn/play and nudges engagement & purchases, respectfully.
export default function AIChatAssistant({ opener }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: opener || "Hi! I'm your Get Goods Gratis (Free) assistant. Want help earning faster today?" }]);
    }
  }, [open]);  

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await base44.functions.invoke('userAssistantChat', { message: text, history: next.slice(-8) });
      setMessages((m) => [...m, { role: 'assistant', content: res.data?.reply || "Let's keep going — what would you like to do?" }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Sorry, I couldn't respond just now. Try again in a moment." }]);
    } finally { setSending(false); }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-white shadow-lg"
          aria-label="Open AI assistant"
        >
          <MessageCircle className="w-5 h-5" /> <span className="hidden sm:inline text-sm font-medium">Assistant</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-[90] flex h-[28rem] w-[92vw] max-w-sm flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-100 p-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-800"><MessageCircle className="w-5 h-5 text-indigo-600" /> Assistant</div>
            <button onClick={() => setOpen(false)} aria-label="Close"><X className="w-5 h-5 text-zinc-400" /></button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'assistant' ? 'bg-zinc-100 text-zinc-800' : 'ml-auto bg-indigo-600 text-white'}`}>
                {m.content}
              </div>
            ))}
            {sending && <div className="flex items-center gap-1 text-zinc-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> thinking…</div>}
          </div>
          <div className="flex items-center gap-2 border-t border-zinc-100 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Ask me anything…"
              className="flex-1 rounded-full border border-zinc-300 px-3 py-2 text-sm"
            />
            <button onClick={send} disabled={sending} className="rounded-full bg-indigo-600 p-2 text-white disabled:opacity-60" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
