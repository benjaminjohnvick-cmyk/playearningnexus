import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User as UserIcon, X, AlertCircle, Phone } from "lucide-react";
import { toast } from "sonner";

export default function AICustomerSupport({ isOpen, onClose, user }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI support assistant. I can help you with:\n\n• Account and earnings questions\n• Survey completion issues\n• Referral program help\n• Premium membership info\n• Technical support\n\nWhat can I help you with today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Check for escalation keywords
      const escalationKeywords = ['human', 'agent', 'representative', 'speak to someone', 'complicated', 'not working'];
      const shouldEscalate = escalationKeywords.some(keyword => 
        input.toLowerCase().includes(keyword)
      );

      if (shouldEscalate) {
        setEscalated(true);
        const response = await base44.entities.SupportTicket.create({
          user_id: user.id,
          subject: 'Escalated from AI Chat',
          description: `User requested human support. Last message: ${input}`,
          status: 'open',
          priority: 'high',
          category: 'general'
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I've escalated your issue to our support team. A human agent will contact you within 24 hours. Your ticket ID is: " + response.id.substring(0, 8),
          timestamp: new Date(),
          escalated: true
        }]);
      } else {
        // Use AI to generate response with context
        const context = `User context:
        - Name: ${user.full_name}
        - Total Earnings: $${user.total_earnings || 0}
        - Premium Member: ${user.premium_membership ? 'Yes' : 'No'}
        - Account Level: ${user.level || 1}
        
        App features:
        - Complete surveys to earn money (50/50 split)
        - Refer friends for commissions
        - Premium membership: $3/day goal for 365 days
        - Transfer funds to other users
        - Browse affiliate marketplace
        
        User question: ${input}
        
        Provide a helpful, concise answer. If this is a complex issue that needs human attention, suggest they can escalate by saying "speak to a human agent".`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt: context,
          add_context_from_internet: false
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble processing your request. Please try again or contact support@gamergain.com",
        timestamp: new Date(),
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8" />
              <div>
                <CardTitle>AI Support Assistant</CardTitle>
                <p className="text-sm text-blue-100">Powered by advanced AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {escalated && (
                <Badge className="bg-red-500">
                  <Phone className="w-3 h-3 mr-1" />
                  Escalated
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.escalated
                    ? 'bg-red-50 border-2 border-red-200'
                    : message.error
                    ? 'bg-yellow-50 border-2 border-yellow-200'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.escalated && (
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-600">Escalated to Human Agent</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              disabled={loading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Say "speak to a human agent" to escalate to our support team
          </p>
        </div>
      </Card>
    </div>
  );
}