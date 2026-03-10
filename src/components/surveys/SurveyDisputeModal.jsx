import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SurveyDisputeModal({ user, isOpen, onClose }) {
  const [form, setForm] = useState({ survey_title: '', expected_amount: '', description: '', provider: 'bitlabs' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.description.trim()) return toast.error('Please describe the issue');
    setSubmitting(true);
    try {
      await base44.entities.SurveyDispute.create({
        user_id: user.id,
        survey_title: form.survey_title,
        expected_amount: parseFloat(form.expected_amount) || 0,
        description: form.description,
        provider: form.provider,
        status: 'pending',
      });
      toast.success('Dispute submitted! Our team will review it within 24–48 hours.');
      onClose();
      setForm({ survey_title: '', expected_amount: '', description: '', provider: 'bitlabs' });
    } catch {
      toast.error('Failed to submit dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Report Missing Survey Credit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-500">If you completed a survey but didn't receive credit, submit a dispute and we'll investigate within 24–48 hours.</p>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Survey Name / Topic (optional)</label>
            <Input placeholder="e.g. Gaming habits survey" value={form.survey_title}
              onChange={e => setForm(f => ({ ...f, survey_title: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Expected Amount (USD)</label>
            <Input type="number" placeholder="e.g. 1.50" value={form.expected_amount}
              onChange={e => setForm(f => ({ ...f, expected_amount: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Provider</label>
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="bitlabs">BitLabs</option>
              <option value="ppc">PPC Marketplace</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description *</label>
            <textarea rows={3} placeholder="Describe what happened — when you took the survey, what it was about, and why you believe you didn't receive credit..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Submit Dispute
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}