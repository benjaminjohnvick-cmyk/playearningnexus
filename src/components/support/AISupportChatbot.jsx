import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, AlertCircle, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function AISupportChatbot({ user, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm your AI support assistant. I can help with:\n\n• Game mechanics & how-to questions\n• In-app purchases & billing\n• Account issues\n• Technical problems\n\nWhat can I help you with today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage) => {
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Get user context
      const userContext = {
        user_id: user.id,
        email: user.email,
        total_earnings: user.total_earnings,
        total_surveys_completed: user.total_surveys_completed,
        game_library: user.game_library,
        current_balance: user.current_balance
      };

      const systemPrompt = `You are a helpful customer support AI for GamerGain, a gaming platform. 

User Context:
- User ID: ${userContext.user_id}
- Email: ${userContext.email}
- Total Earnings: $${userContext.total_earnings}
- Surveys Completed: ${userContext.total_surveys_completed}
- Games Owned: ${userContext.game_library?.length || 0}
- Current Balance: $${userContext.current_balance}

Platform Information:
- GamerGain is a game discovery platform with survey-based monetization
- Users earn money by completing surveys and playing games
- 50/50 revenue share between platform and game developers
- Users can cash out via PayPal when balance reaches $10
- All games undergo approval before being featured

Your role:
1. Answer questions about game mechanics, purchases, and account issues
2. Be friendly, helpful, and concise
3. If the issue requires human support (billing disputes, account security, technical bugs), recommend escalating to a support ticket
4. Provide specific instructions when possible
5. Never make up information - if you don't know, say so and suggest escalation

Previous conversation:
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's question: ${userMessage}

Provide a helpful response. If this issue needs human support, end your message with: [ESCALATE_TO_HUMAN]`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: systemPrompt
      });

      return {
        response,
        shouldEscalate: response.includes('[ESCALATE_TO_HUMAN]'),
        userContext
      };
    },
    onSuccess: ({ response, shouldEscalate, userContext }) => {
      const cleanResponse = response.replace('[ESCALATE_TO_HUMAN]', '').trim();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date().toISOString()
      }]);

      if (shouldEscalate) {
        // Show escalation option
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'escalate_option',
          timestamp: new Date().toISOString()
        }]);
      }

      setIsTyping(false);
    },
    onError: () => {
      toast.error('Failed to get response');
      setIsTyping(false);
    }
  });

  const escalateToHumanMutation = useMutation({
    mutationFn: async () => {
      const chatHistory = messages.filter(m => m.role !== 'system');
      
      const ticket = await base44.entities.SupportTicket.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        category: 'user_support',
        subject: 'Escalated from AI Chat',
        description: `User conversation escalated from AI support.\n\nChat History:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n\n')}`,
        status: 'open',
        priority: 'medium',
        escalated_from_ai: true,
        chat_history: chatHistory,
        player_data_snapshot: {
          total_earnings: user.total_earnings,
          total_surveys_completed: user.total_surveys_completed,
          game_library: user.game_library,
          current_balance: user.current_balance
        }
      });

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['supportTickets']);
      toast.success('Ticket created! Our team will respond within 24 hours.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "✅ I've created a support ticket for you. A human agent will review your case and respond via email within 24 hours. Your ticket includes our full conversation and your account details.",
        timestamp: new Date().toISOString()
      }]);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    sendMessageMutation.mutate(input);
  };

  const quickQuestions = [
    "How do I cash out my earnings?",
    "Why was my game not approved?",
    "How do in-app purchases work?",
    "I can't log into my account"
  ];

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] flex flex-col shadow-2xl z-50">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Support Assistant
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Badge className="bg-green-500 w-fit">Online</Badge>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <React.Fragment key={idx}>
              {msg.role === 'system' && msg.content === 'escalate_option' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-orange-50 border-2 border-orange-300 p-4 rounded-lg"
                >
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-900">Need Human Support?</p>
                      <p className="text-sm text-orange-700">
                        This issue might need a human agent. Would you like to create a support ticket?
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => escalateToHumanMutation.mutate()}
                    disabled={escalateToHumanMutation.isPending}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    Create Support Ticket
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="w-4 h-4" />
                        <span className="text-xs font-semibold">AI Assistant</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              )}
            </React.Fragment>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex items-center gap-2 text-gray-500">
            <Bot className="w-4 h-4" />
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {messages.length === 1 && (
        <div className="px-4 pb-2 space-y-2">
          <p className="text-xs text-gray-500">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(q);
                  handleSend();
                }}
                className="text-xs"
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your question..."
            disabled={isTyping}
          />
          <Button onClick={handleSend} disabled={isTyping || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}