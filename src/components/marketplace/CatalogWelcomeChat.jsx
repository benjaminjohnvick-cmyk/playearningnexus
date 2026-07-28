import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';

// CatalogWelcomeChat — the AI shopping assistant that greets a member the FIRST time they open the
// marketplace catalog and asks what they're interested in. It's grounded server-side in the member's
// KYC survey answers, so the opening question is personalized rather than generic. Auto-opens once per
// browser session; afterwards it stays available as a floating launcher. Powered by catalogAssistantChat.
export default function CatalogWelcomeChat() {
  const [open, setOpen] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [messages, setMessages] = useState([]);   // { role, content }
  const [chips, setChips] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const greet = useCallback(async () => {
    if (greeted) return;
    setGreeted(true);
    setBusy(true);
    try {
      const r = await base44.functions.invoke('catalogAssistantChat', { action: 'greet' });
      const g = r?.data?.greeting || "Hi! What are you shopping for today? Tell me a category or product and I'll find matches.";
      setMessages([{ role: 'assistant', content: g }]);
      setChips(Array.isArray(r?.data?.suggested_interests) ? r.data.suggested_interests : []);
    } catch {
      setMessages([{ role: 'assistant', content: "Hi! What are you shopping for today?" }]);
    } finally {
      setBusy(false);
    }
  }, [greeted]);

  // Auto-open once per browser session on first catalog view.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('gg_catalog_greeted') === '1'; } catch { /* ignore */ }
    if (!seen) {
      try { sessionStorage.setItem('gg_catalog_greeted', '1'); } catch { /* ignore */ }
      setOpen(true);
      greet();
    }
  }, [greet]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setChips([]);
    setBusy(true);
    try {
      const r = await base44.functions.invoke('catalogAssistantChat', { message: msg, history });
      setMessages((m) => [...m, { role: 'assistant', content: r?.data?.reply || "Let me help you find that." }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Sorry — I had trouble there. Try again?" }]);
    } finally {
      setBusy(false);
    }
  }

  function openAndGreet() { setOpen(true); if (!greeted) greet(); }

  if (!open) {
    return (
      <button
        onClick={openAndGreet}
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-700"
      >
        <Sparkles className="h-4 w-4" /> Shopping help
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex w-[92vw] max-w-sm flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4" /> Your shopping assistant</div>
        <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button>
      </div>

      <div ref={scrollRef} className="max-h-80 min-h-[10rem] space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </span>
          </div>
        ))}
        {busy && <div className="text-left"><span className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> thinking…</span></div>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map((c) => (
              <button key={c} onClick={() => send(`I'm interested in ${c}`)} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="What are you looking for?"
          className="text-sm"
        />
        <Button size="icon" onClick={() => send()} disabled={busy || !input.trim()} className="bg-purple-600 hover:bg-purple-700">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
