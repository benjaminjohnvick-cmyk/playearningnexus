import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from "framer-motion";

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Welcome to GamerGain! I\'m your AI assistant.\n\nI can help you with:\n• 🎮 Finding and playing games\n• 📊 Completing surveys ($0.50-$2.00 each)\n• 🏆 Joining tournaments\n• 💰 Maximizing your earnings\n• 👥 Referral programs & contests\n• 🎯 Guilds, achievements & challenges\n• 🛠️ Developer tools & monetization\n\nWhat would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are GamerGain AI Assistant, an expert on the GamerGain platform - a comprehensive gaming ecosystem where users can:

**Core Features:**
- Play and discover premium games from developers worldwide
- Complete surveys and earn real money (50/50 revenue share with platform)
- Participate in tournaments including innovative cross-game tournaments
- Join guilds and compete in guild challenges
- Build referral networks and earn revenue share (tiered system with up to 10% commissions)
- Stream games and receive virtual gifts/tips from viewers
- Access in-game stores with dynamic AI-powered pricing
- Customize profiles with achievements, badges, and cosmetics

**For Developers:**
- Submit games to the marketplace
- Access advanced analytics and AI optimization tools
- Use dynamic pricing and promotional AI systems
- Manage monetization through subscriptions, IAPs, and event-based pricing
- Receive automated payouts via PayPal integration
- Access developer support chatbot for technical assistance

**Earning Opportunities:**
- $0.50-$2.00 per survey completed
- Revenue share from referred users (multi-tier system)
- Tournament prizes (virtual currency or real money)
- Daily challenges and achievement rewards
- Referral contests with celebrity AI-generated content
- Developer revenue share (50/50 split on games)

**Social & Community:**
- Friend system with endorsements
- Guild system with dedicated spaces (forums, chat, events)
- Activity feeds and social sharing
- Live streaming integration
- Virtual gifts and in-game currency

**User Question:** ${userMessage}

**Instructions:**
- Provide accurate, comprehensive answers about GamerGain features
- Be enthusiastic and helpful
- Include specific examples and earning amounts when relevant
- For technical questions, explain clearly step-by-step
- If asked about earning potential, be realistic and mention survey/referral opportunities
- Highlight unique features like cross-game tournaments and AI pricing
- Keep responses friendly and conversational
- If unsure, direct users to specific dashboard sections or support

Respond naturally and helpfully:`
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again!' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-16 w-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg hover:shadow-xl"
            >
              <Sparkles className="w-6 h-6" />
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
            <Card className="border-0 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>AI Assistant</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-96 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask me anything..."
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage} disabled={loading}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}