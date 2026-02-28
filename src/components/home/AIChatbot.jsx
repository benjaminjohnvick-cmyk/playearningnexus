import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Sparkles, Loader2, Settings, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from "framer-motion";

const QUICK_SUGGESTIONS = [
  { label: '💰 How to earn?', prompt: 'How do I start earning money on GamerGain?' },
  { label: '👥 Refer friends', prompt: 'How does the referral program work?' },
  { label: '🎮 Game store', prompt: 'How do I browse and play games in the store?' },
  { label: '🏆 Tournaments', prompt: 'How do I join a tournament?' },
  { label: '📊 Surveys', prompt: 'How much can I earn from surveys?' },
  { label: '🎯 Daily goals', prompt: 'What are daily goals and how do they work?' },
];

const PROACTIVE_TIPS = [
  { id: 'surveys', message: '💡 Did you know? You can earn $0.50–$2.00 per survey! Head to your Dashboard to start earning right now.', delay: 30000 },
  { id: 'referrals', message: '👥 Tip: Referring friends earns you ongoing commissions. Share your referral link from the Referrals page!', delay: 90000 },
  { id: 'tournament', message: '🏆 Tournaments are live! Join a tournament now to win prizes and climb the leaderboard.', delay: 180000 },
];

const DEFAULT_PREFS = {
  tone: 'friendly',
  proactive: true,
  quickSuggestions: true,
  notifyTips: true,
};

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveTip, setProactiveTip] = useState(null);
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('chatbot_prefs') || '{}') }; }
    catch { return DEFAULT_PREFS; }
  });
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Welcome to GamerGain! I\'m your AI assistant.\n\nI can help you with:\n• 🎮 Finding and playing games\n• 📊 Completing surveys ($0.50–$2.00 each)\n• 🏆 Tournaments & guilds\n• 💰 Maximizing your earnings\n• 👥 Referral programs\n\nWhat would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const shownTips = useRef(new Set());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Save prefs
  useEffect(() => {
    localStorage.setItem('chatbot_prefs', JSON.stringify(prefs));
  }, [prefs]);

  // Proactive tips based on time-on-page
  useEffect(() => {
    if (!prefs.proactive || !prefs.notifyTips) return;
    const timers = PROACTIVE_TIPS.map(tip => {
      return setTimeout(() => {
        if (!isOpen && !shownTips.current.has(tip.id)) {
          shownTips.current.add(tip.id);
          setProactiveTip(tip.message);
          setShowProactiveBubble(true);
          setTimeout(() => setShowProactiveBubble(false), 8000);
        }
      }, tip.delay);
    });
    return () => timers.forEach(clearTimeout);
  }, [prefs.proactive, prefs.notifyTips, isOpen]);

  const getToneInstruction = () => {
    if (prefs.tone === 'professional') return 'Be professional, concise, and formal in your responses.';
    if (prefs.tone === 'casual') return 'Be very casual, use slang and keep it super short and fun.';
    return 'Be friendly, enthusiastic, and conversational.';
  };

  const sendMessage = async (text) => {
    const userMessage = text || input;
    if (!userMessage.trim()) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are GamerGain AI Assistant. ${getToneInstruction()}

**Platform Overview:**
- Play games, earn money through surveys ($0.50–$2.00 each, 50/50 revenue share)
- Refer friends and earn ongoing commissions (multi-tier system)
- Participate in tournaments, guilds, challenges
- Developers can submit games and monetize them
- Daily goals: earn $3/day to unlock Premium benefits
- Transfer money, use wishlist, buy games with survey earnings

**User Question:** ${userMessage}

Respond helpfully and accurately. Keep it concise.`
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  const handleProactiveBubbleClick = () => {
    setShowProactiveBubble(false);
    setIsOpen(true);
    if (proactiveTip) {
      setMessages(prev => [...prev, { role: 'assistant', content: proactiveTip }]);
    }
  };

  const updatePref = (key, value) => setPrefs(p => ({ ...p, [key]: value }));

  return (
    <>
      {/* Proactive tip bubble */}
      <AnimatePresence>
        {showProactiveBubble && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="fixed bottom-28 right-6 z-50 max-w-xs cursor-pointer"
            onClick={handleProactiveBubbleClick}
          >
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-purple-200 p-4">
              <div className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-800">{proactiveTip}</p>
              </div>
              <p className="text-xs text-purple-500 mt-2 font-medium">Tap to open chat →</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={() => setIsOpen(true)}
              className="h-16 w-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg hover:shadow-xl relative"
            >
              <Sparkles className="w-6 h-6" />
              {showProactiveBubble && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96"
          >
            <Card className="border-0 shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
              {/* Header */}
              <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-xl flex-shrink-0">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>AI Assistant</span>
                    <Badge className="bg-white/20 text-white text-xs px-2 py-0 border-0 capitalize">{prefs.tone}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setShowPrefs(p => !p)} className="text-white hover:bg-white/20 h-8 w-8">
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20 h-8 w-8">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>

              {/* Preferences Panel */}
              <AnimatePresence>
                {showPrefs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-purple-50 border-b border-purple-100"
                  >
                    <div className="p-4 space-y-3">
                      <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">Chatbot Preferences</p>

                      {/* Tone */}
                      <div>
                        <p className="text-xs text-gray-600 mb-1 font-medium">Response Tone</p>
                        <div className="flex gap-2">
                          {['friendly', 'professional', 'casual'].map(t => (
                            <button key={t}
                              onClick={() => updatePref('tone', t)}
                              className={`text-xs px-2 py-1 rounded-full border transition-all capitalize ${prefs.tone === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                            >{t}</button>
                          ))}
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="space-y-2">
                        {[
                          { key: 'proactive', label: 'Proactive suggestions' },
                          { key: 'quickSuggestions', label: 'Show quick prompts' },
                          { key: 'notifyTips', label: 'Show tip notifications' },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                            <span>{label}</span>
                            <div
                              onClick={() => updatePref(key, !prefs[key])}
                              className={`w-8 h-4 rounded-full relative transition-colors ${prefs[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
                            >
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${prefs[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                        <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span className="text-xs text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestions */}
                {prefs.quickSuggestions && messages.length <= 2 && (
                  <div className="px-3 pb-2">
                    <p className="text-xs text-gray-400 mb-2">Quick questions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map(s => (
                        <button key={s.label} onClick={() => sendMessage(s.prompt)}
                          className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded-full transition-colors">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
                    className="text-sm"
                  />
                  <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon" className="bg-purple-600 hover:bg-purple-700 flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}