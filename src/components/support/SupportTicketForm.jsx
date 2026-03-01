import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { LifeBuoy, Send, Sparkles, Loader2, Bot, ChevronDown, ChevronUp } from "lucide-react";

export default function SupportTicketForm({ user, onSuccess }) {
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAiResponse, setShowAiResponse] = useState(true);

  const generateAIResponse = async (ticketId) => {
    if (!formData.subject || !formData.description) return;
    setGeneratingAI(true);
    try {
      const res = await base44.functions.invoke('aiSupportEngine', {
        action: 'generate_ticket_response',
        ticket_id: ticketId,
        category: formData.category,
        subject: formData.subject,
        description: formData.description,
        user_name: user.full_name,
      });
      setAiResponse(res.data?.data || null);
    } catch (e) {
      // silently fail, don't block ticket submission
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const ticket = await base44.entities.SupportTicket.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        category: formData.category,
        subject: formData.subject,
        description: formData.description
      });

      // Generate AI response in background
      generateAIResponse(ticket.id);

      // Send email notification to support
      await base44.integrations.Core.SendEmail({
        to: 'benjaminjohnvick@gmail.com',
        subject: `[Support Ticket] ${formData.category}: ${formData.subject}`,
        body: `
New Support Ticket

Category: ${formData.category}
From: ${user.full_name} (${user.email})
Subject: ${formData.subject}

Description:
${formData.description}

User ID: ${user.id}
        `
      });

      toast.success('Support ticket submitted! Generating AI response...');
      setFormData({ category: '', subject: '', description: '' });
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 bg-white border-2 border-red-200">
      <div className="flex items-center gap-3 mb-6">
        <LifeBuoy className="w-6 h-6 text-red-600" />
        <h3 className="text-2xl font-bold text-gray-900">Submit Support Ticket</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Category</label>
          <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user_support">User Support</SelectItem>
              <SelectItem value="developer_support">App Developer Support</SelectItem>
              <SelectItem value="billing">Billing & Payments</SelectItem>
              <SelectItem value="technical">Technical Issue</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
              <SelectItem value="bug_report">Bug Report</SelectItem>
              <SelectItem value="account">Account Issue</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Subject</label>
          <Input
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            placeholder="Brief description of your issue"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Please provide detailed information about your issue"
            className="h-32"
            required
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full bg-red-600 hover:bg-red-700">
          <Send className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </form>

      {/* AI Response Section */}
      {(generatingAI || aiResponse) && (
        <div className="mt-4 border-t pt-4">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-3 w-full"
            onClick={() => setShowAiResponse(!showAiResponse)}
          >
            <Bot className="w-4 h-4" />
            AI Instant Response
            {aiResponse && <Badge className="bg-blue-100 text-blue-700 text-xs">{aiResponse.confidence}% confidence</Badge>}
            <span className="ml-auto">{showAiResponse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          </button>

          {showAiResponse && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              {generatingAI && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating personalized response...
                </div>
              )}
              {aiResponse && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResponse.response_text}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {aiResponse.suggested_priority && (
                      <Badge className="text-xs bg-gray-100 text-gray-600">Priority: {aiResponse.suggested_priority}</Badge>
                    )}
                    {aiResponse.resolution_type && (
                      <Badge className="text-xs bg-blue-100 text-blue-700">{aiResponse.resolution_type?.replace('_', ' ')}</Badge>
                    )}
                  </div>
                  {aiResponse.related_docs?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-xs text-gray-400">Related:</span>
                      {aiResponse.related_docs.map((d, i) => (
                        <span key={i} className="text-xs text-blue-500">{d}{i < aiResponse.related_docs.length - 1 ? ', ' : ''}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI-generated response · A human agent will review if needed
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}