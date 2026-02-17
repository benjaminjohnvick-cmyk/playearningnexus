import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  X, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const FAQ_DATABASE = {
  referrals: [
    { q: "How do I create a referral link?", a: "Go to Referral Tracking page and click 'Create New Link'. You can customize it for different campaigns and platforms." },
    { q: "When do I get paid for referrals?", a: "We operate on Net 90 payment terms. Your earnings are paid out 90 days after they're earned, with a minimum threshold of $50." },
    { q: "How much do I earn per referral?", a: "User referrals: $5-$50 based on tier. Business referrals: $100-$500. Plus ongoing commissions!" },
    { q: "What is the Mega Millionaire opportunity?", a: "For every 7 million users you refer, you earn 10% of ALL their profits - unlimited earning potential!" }
  ],
  payouts: [
    { q: "How do I set up my payout method?", a: "Visit Payout Settings to configure PayPal, Bank Transfer, or Stripe as your payment method." },
    { q: "When will I receive my payout?", a: "Payouts are processed on Net 90 terms. Check Payout History to see scheduled payment dates." },
    { q: "What is the minimum payout?", a: "The minimum payout threshold is $50. Earnings below this will accumulate until you reach the threshold." },
    { q: "Can I change my payout method?", a: "Yes, update your payout preferences anytime in Payout Settings. Changes apply to future payouts." }
  ],
  platform: [
    { q: "How do achievements work?", a: "Earn badges and points by hitting referral milestones. View your achievements in Referral Analytics > Achievements tab." },
    { q: "What are A/B tests?", a: "Test different referral links or campaigns to see which performs better. Create tests in the Analytics dashboard." },
    { q: "How do I track my performance?", a: "Visit Referral Analytics for detailed stats, predictions, and customizable reports on your referral performance." }
  ]
};

export default function AISupportChatbot({ user, isOpen, onClose, initialMessage = null }) {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Initialize conversation
  useEffect(() => {
    if (isOpen && !conversationId) {
      const newConvId = `support_${user.id}_${Date.now()}`;
      setConversationId(newConvId);
      
      const welcomeMsg = {
        id: 'welcome',
        sender_type: 'support_ai',
        message: `Hi ${user.full_name}! 👋 I'm your AI support assistant. I can help you with:\n\n• Referral questions\n• Payout information\n• Platform features\n• Troubleshooting\n\nWhat can I help you with today?`,
        created_date: new Date().toISOString()
      };
      
      setMessages([welcomeMsg]);
      
      if (initialMessage) {
        setTimeout(() => handleSendMessage(initialMessage), 500);
      }
    }
  }, [isOpen, conversationId, user, initialMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const findFAQAnswer = (question) => {
    const lowerQ = question.toLowerCase();
    
    for (const category in FAQ_DATABASE) {
      for (const faq of FAQ_DATABASE[category]) {
        if (lowerQ.includes(faq.q.toLowerCase().split(' ').slice(0, 3).join(' '))) {
          return faq.a;
        }
      }
    }
    
    // Check for keyword matches
    if (lowerQ.includes('referral') && lowerQ.includes('link')) {
      return FAQ_DATABASE.referrals[0].a;
    }
    if (lowerQ.includes('payout') || lowerQ.includes('payment') || lowerQ.includes('paid')) {
      return FAQ_DATABASE.payouts[0].a;
    }
    if (lowerQ.includes('earn') || lowerQ.includes('money')) {
      return FAQ_DATABASE.referrals[2].a;
    }
    
    return null;
  };

  const sendAIMessageMutation = useMutation({
    mutationFn: async (userMessage) => {
      // Check FAQ first
      const faqAnswer = findFAQAnswer(userMessage);
      
      if (faqAnswer) {
        return {
          message: faqAnswer,
          isEscalation: false
        };
      }
      
      // Use AI for complex queries
      const context = `You are a helpful support agent for GamerGain, a referral platform. 
      
User asking: ${user.full_name} (${user.email})
User stats: ${user.total_referrals || 0} referrals, $${user.total_earnings || 0} earned

Key platform info:
- User referrals: $5-$50 per user (tier-based)
- Business referrals: $100-$500 per business
- Mega Millionaire: 10% of all profits from 7M users referred
- Payment terms: Net 90, minimum $50
- Features: A/B testing, predictive analytics, gamification

User question: ${userMessage}

Provide a helpful, friendly response. If the issue seems complex or requires human review (account issues, payment problems, technical bugs), suggest escalation.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        response_json_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            should_escalate: { type: 'boolean' },
            escalation_reason: { type: 'string' }
          }
        }
      });

      return {
        message: result.message,
        isEscalation: result.should_escalate,
        escalationReason: result.escalation_reason
      };
    }
  });

  const escalateToHumanMutation = useMutation({
    mutationFn: async (reason) => {
      await base44.entities.SupportTicket.create({
        user_id: user.id,
        category: 'escalation',
        subject: 'Escalated from AI Chat',
        description: `Conversation escalated from AI support.\n\nReason: ${reason}\n\nConversation ID: ${conversationId}`,
        priority: 'high',
        status: 'open'
      });
    },
    onSuccess: () => {
      const escalationMsg = {
        id: `escalation_${Date.now()}`,
        sender_type: 'support_ai',
        message: "✅ I've escalated your issue to our human support team. They'll reach out within 24 hours. Your ticket has been created and you'll receive email updates.",
        message_type: 'escalation',
        created_date: new Date().toISOString()
      };
      setMessages(prev => [...prev, escalationMsg]);
      toast.success('Escalated to human support');
    }
  });

  const handleSendMessage = async (messageText = null) => {
    const msgToSend = messageText || inputMessage.trim();
    if (!msgToSend) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender_type: 'user',
      message: msgToSend,
      created_date: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Show typing indicator
    const typingMsg = {
      id: 'typing',
      sender_type: 'support_ai',
      message: '...',
      isTyping: true,
      created_date: new Date().toISOString()
    };
    setMessages(prev => [...prev, typingMsg]);

    try {
      const response = await sendAIMessageMutation.mutateAsync(msgToSend);
      
      setMessages(prev => prev.filter(m => m.id !== 'typing'));

      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender_type: 'support_ai',
        message: response.message,
        created_date: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);

      if (response.isEscalation) {
        const confirmMsg = {
          id: `confirm_${Date.now()}`,
          sender_type: 'support_ai',
          message: "This seems like something our human support team should handle. Would you like me to escalate this to them?",
          showEscalateButton: true,
          escalationReason: response.escalationReason,
          created_date: new Date().toISOString()
        };
        setMessages(prev => [...prev, confirmMsg]);
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
      toast.error('Failed to send message');
    }
  };

  const handleEscalate = (reason) => {
    escalateToHumanMutation.mutate(reason);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`border-2 border-blue-300 shadow-2xl transition-all ${isMinimized ? 'w-80' : 'w-96'}`}>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <div>
              <CardTitle className="text-base">AI Support Assistant</CardTitle>
              <Badge className="bg-green-400 text-green-900 text-xs">Online</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="p-4 h-96 overflow-y-auto bg-gray-50">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender_type !== 'user' && (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-lg p-3 ${
                      msg.sender_type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-200'
                    }`}>
                      {msg.isTyping ? (
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          {msg.showEscalateButton && (
                            <Button
                              size="sm"
                              className="mt-3 w-full bg-orange-600 hover:bg-orange-700"
                              onClick={() => handleEscalate(msg.escalationReason)}
                            >
                              <AlertCircle className="w-3 h-3 mr-2" />
                              Escalate to Human Support
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    {msg.sender_type === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>

            <div className="border-t p-4 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your question..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={sendAIMessageMutation.isPending}
                />
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || sendAIMessageMutation.isPending}
                  className="bg-blue-600"
                >
                  {sendAIMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Powered by AI • Escalate anytime for human help
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}