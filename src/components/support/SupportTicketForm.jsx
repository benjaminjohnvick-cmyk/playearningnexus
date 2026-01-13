import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { LifeBuoy, Send } from "lucide-react";

export default function SupportTicketForm({ user, onSuccess }) {
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await base44.entities.SupportTicket.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        category: formData.category,
        subject: formData.subject,
        description: formData.description
      });

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

      toast.success('Support ticket submitted successfully!');
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
    </Card>
  );
}