import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Bot, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DeveloperSupportChatbot({ isOpen, onClose, developerId, developerEmail }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [ticketId, setTicketId] = useState(null);
  const [isEscalated, setIsEscalated] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !ticketId) {
      // Add welcome message
      setMessages([{
        role: 'assistant',
        message: 'Hello! I\'m your AI developer support assistant. I can help you with questions about developer agreements, app submissions, compliance checks, and payouts. How can I assist you today?',
        timestamp: new Date().toISOString()
      }]);
    }
  }, [isOpen, ticketId]);

  // Fetch developer context
  const { data: developerContext } = useQuery({
    queryKey: ['developerContext', developerId],
    queryFn: async () => {
      const client = await base44.entities.BusinessClient.filter({ id: developerId });
      const games = await base44.entities.Game.filter({ developer_id: developerId });
      const transactions = await base44.entities.Transaction.filter({ business_client_id: developerId });
      
      return {
        client: client[0],
        games,
        transactions: transactions.slice(0, 10)
      };
    },
    enabled: !!developerId && isOpen
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage) => {
      // Create or update ticket
      let currentTicketId = ticketId;
      
      if (!currentTicketId) {
        const ticket = await base44.entities.DeveloperSupportTicket.create({
          developer_id: developerId,
          developer_email: developerEmail,
          category: 'general',
          subject: userMessage.substring(0, 100),
          status: 'ai_handling',
          developer_context: developerContext
        });
        currentTicketId = ticket.id;
        setTicketId(currentTicketId);
      }

      // Prepare AI prompt with context
      const contextPrompt = `You are a developer support assistant for GamerGain platform. 
      
Developer Context:
- Company: ${developerContext?.client?.company_name || 'N/A'}
- Games submitted: ${developerContext?.games?.length || 0}
- Total revenue: $${developerContext?.client?.total_revenue || 0}
- Account status: ${developerContext?.client?.account_status || 'N/A'}

Common topics you can help with:
1. Developer Agreement: Revenue share is 50/50 after $0.50 install fees. 100k install minimum contract.
2. App Submission: Submit through developer portal, includes review process (2-5 days)
3. Compliance: Must maintain valid certificates, follow platform policies
4. Payouts: Automated monthly via PayPal, $100 minimum threshold
5. Featured Slots: $600k priority payment for featured placement

If the question requires account-specific actions, balance adjustments, or complex troubleshooting, you should escalate to a human agent.

User question: ${userMessage}

Provide a helpful, concise response. If you need to escalate, start your response with "ESCALATE:"`;

      // Call AI
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: contextPrompt
      });

      // Check if escalation is needed
      const shouldEscalate = aiResponse.startsWith('ESCALATE:');
      const cleanResponse = shouldEscalate ? aiResponse.replace('ESCALATE:', '').trim() : aiResponse;

      // Update conversation
      const updatedConversation = [
        ...messages,
        { role: 'user', message: userMessage, timestamp: new Date().toISOString() },
        { role: 'assistant', message: cleanResponse, timestamp: new Date().toISOString() }
      ];

      await base44.entities.DeveloperSupportTicket.update(currentTicketId, {
        ai_conversation: updatedConversation,
        status: shouldEscalate ? 'escalated' : 'ai_handling',
        escalation_reason: shouldEscalate ? 'Complex issue requiring human support' : null
      });

      return { response: cleanResponse, shouldEscalate, conversation: updatedConversation };
    },
    onSuccess: (data) => {
      setMessages(data.conversation);
      setInputMessage('');
      
      if (data.shouldEscalate) {
        setIsEscalated(true);
        toast.success('Your request has been escalated to a human support agent');
      }
    },
    onError: () => {
      toast.error('Failed to send message');
    }
  });

  const handleSend = () => {
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;
    
    const userMsg = inputMessage;
    setMessages(prev => [...prev, {
      role: 'user',
      message: userMsg,
      timestamp: new Date().toISOString()
    }]);
    
    sendMessageMutation.mutate(userMsg);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6" />
            <div>
              <h2 className="font-bold">Developer Support AI</h2>
              <p className="text-sm opacity-90">
                {isEscalated ? 'Escalated to human agent' : 'AI-powered support'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEscalated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Escalated to Human Support</p>
                <p className="text-sm text-yellow-700">
                  A support agent will review your conversation and respond shortly.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-5 h-5 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isEscalated ? 'Your message will be sent to support team...' : 'Ask about agreements, submissions, compliance, payouts...'}
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || sendMessageMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}