import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Send, Loader2, Upload, X, CheckCircle, Receipt } from 'lucide-react';
import { toast } from 'sonner';

export default function SurveyDisputeModal({ user, isOpen, onClose }) {
  const [form, setForm] = useState({
    survey_title: '',
    expected_amount: '',
    description: '',
    provider: 'bitlabs',
    transaction_id: '',
  });
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load user's recent transactions to select from
  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 30),
    enabled: !!user?.id && isOpen,
  });

  const surveyTransactions = transactions.filter(t =>
    ['survey_payout', 'ppc_earning'].includes(t.transaction_type)
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleTransactionSelect = (tx) => {
    setForm(f => ({
      ...f,
      transaction_id: tx.id,
      expected_amount: (tx.amount || '').toString(),
      survey_title: f.survey_title || tx.description || '',
      provider: tx.transaction_type === 'survey_payout' ? 'bitlabs' : 'ppc',
    }));
  };

  const handleSubmit = async () => {
    if (!form.description.trim()) return toast.error('Please describe the issue');
    setSubmitting(true);

    let screenshotUrl = null;

    // Upload screenshot if provided
    if (screenshotFile) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: screenshotFile });
      screenshotUrl = file_url;
      setUploading(false);
    }

    const selectedTx = transactions.find(t => t.id === form.transaction_id);

    const dispute = await base44.entities.SurveyDispute.create({
      user_id: user.id,
      survey_title: form.survey_title,
      expected_amount: parseFloat(form.expected_amount) || 0,
      description: form.description,
      provider: form.provider,
      screenshot_url: screenshotUrl,
      transaction_id: form.transaction_id || null,
      transaction_date: selectedTx?.created_date || null,
      status: 'pending',
      review_task_created: true,
    });

    // Create admin review notification as a support ticket task
    await base44.entities.SupportTicket.create({
      user_id: user.id,
      subject: `[DISPUTE REVIEW] ${form.survey_title || 'Survey'} — $${parseFloat(form.expected_amount || 0).toFixed(2)}`,
      message: `User submitted a missing credit dispute.\n\nDescription: ${form.description}\nProvider: ${form.provider}\nExpected: $${parseFloat(form.expected_amount || 0).toFixed(2)}\nTransaction ID: ${form.transaction_id || 'not selected'}\nScreenshot: ${screenshotUrl ? 'Attached' : 'None'}\nDispute ID: ${dispute.id}`,
      status: 'open',
      priority: 'high',
      category: 'dispute',
      dispute_id: dispute.id,
      screenshot_url: screenshotUrl,
    });

    toast.success('Dispute submitted! Our team will review it within 24–48 hours.');
    onClose();
    setForm({ survey_title: '', expected_amount: '', description: '', provider: 'bitlabs', transaction_id: '' });
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setSubmitting(false);
  };

  const selectedTx = transactions.find(t => t.id === form.transaction_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Report Missing Survey Credit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-500">
            Select the transaction you didn't receive, upload your completion screenshot, and we'll review it within 24–48 hours.
          </p>

          {/* Transaction Selector */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              <Receipt className="w-3.5 h-3.5 inline mr-1" />
              Select Missing Transaction (optional)
            </label>
            {surveyTransactions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No recent survey transactions found.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {surveyTransactions.map(tx => (
                  <div key={tx.id}
                    onClick={() => handleTransactionSelect(tx)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                      form.transaction_id === tx.id
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{tx.description || tx.transaction_type}</p>
                      <p className="text-xs text-gray-400">{new Date(tx.created_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-green-600 font-semibold">${(tx.amount || 0).toFixed(2)}</span>
                      {form.transaction_id === tx.id && <CheckCircle className="w-4 h-4 text-amber-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Survey Name / Topic</label>
            <Input placeholder="e.g. Gaming habits survey" value={form.survey_title}
              onChange={e => setForm(f => ({ ...f, survey_title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Expected Amount (USD)</label>
              <Input type="number" placeholder="e.g. 1.50" value={form.expected_amount}
                onChange={e => setForm(f => ({ ...f, expected_amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Provider</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="bitlabs">BitLabs</option>
                <option value="ppc">PPC Marketplace</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description *</label>
            <textarea rows={3}
              placeholder="Describe what happened — when you took the survey, what it was about, and why you believe you didn't receive credit..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              <Upload className="w-3.5 h-3.5 inline mr-1" />
              Completion Screenshot (recommended)
            </label>
            {screenshotPreview ? (
              <div className="relative">
                <img src={screenshotPreview} alt="Screenshot preview"
                  className="w-full h-36 object-cover rounded-lg border border-gray-200" />
                <button onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-gray-200 hover:bg-red-50">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors">
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">Click to upload screenshot</span>
                <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || uploading}
              className="flex-1 bg-amber-500 hover:bg-amber-600">
              {(submitting || uploading)
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <Send className="w-4 h-4 mr-1" />}
              {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit Dispute'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}