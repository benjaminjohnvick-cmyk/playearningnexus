import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle, Gamepad2, FileText, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CLAIM_TYPES = [
  { value: 'game_not_credited', label: 'Game Not Credited', icon: Gamepad2, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { value: 'survey_not_credited', label: 'Survey Not Credited', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { value: 'wrong_amount', label: 'Wrong Amount Paid', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { value: 'other', label: 'Other Issue', icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
];

export default function GameSurveyClaimForm({ user, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    claim_type: 'survey_not_credited',
    item_name: '',
    expected_amount: '',
    description: '',
    completion_date: '',
    proof_urls: [],
  });
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.DisputeClaim.create({
      ...data,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      status: 'pending',
      expected_amount: parseFloat(data.expected_amount) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['dispute-claims']);
      setSubmitted(true);
      toast.success('Claim submitted! You\'ll be notified by email when reviewed.');
      onSuccess?.();
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, proof_urls: [...f.proof_urls, file_url] }));
    setUploading(false);
    toast.success('Proof uploaded!');
  };

  if (submitted) return (
    <div className="text-center py-10 space-y-3">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      <h3 className="text-lg font-bold text-gray-900">Claim Submitted!</h3>
      <p className="text-sm text-gray-500">Our team will review your claim within 24–48 hours.<br />You'll receive an email notification with the decision.</p>
      <Button variant="outline" onClick={() => setSubmitted(false)} className="mt-2">Submit Another</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Claim Type */}
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">What type of claim is this?</label>
        <div className="grid grid-cols-2 gap-2">
          {CLAIM_TYPES.map(ct => {
            const Icon = ct.icon;
            const selected = form.claim_type === ct.value;
            return (
              <button key={ct.value} onClick={() => setForm(f => ({...f, claim_type: ct.value}))}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all
                  ${selected ? ct.bg + ' border-2' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? ct.color : 'text-gray-400'}`} />
                <span className={`text-xs font-semibold ${selected ? ct.color.replace('600','800') : 'text-gray-600'}`}>{ct.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Game / Survey Name *</label>
          <input value={form.item_name} onChange={e => setForm(f => ({...f, item_name: e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            placeholder="e.g. Daily Gamer Survey, Space Adventure" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Expected Credit Amount ($)</label>
          <input type="number" value={form.expected_amount} onChange={e => setForm(f => ({...f, expected_amount: e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            placeholder="e.g. 2.50" min="0" step="0.01" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Completion Date</label>
          <input type="date" value={form.completion_date} onChange={e => setForm(f => ({...f, completion_date: e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="md:row-span-2">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Description of Issue *</label>
          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
            placeholder="Describe what happened. Include any error messages or transaction IDs you saw..." />
        </div>
      </div>

      {/* Proof Upload */}
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">Proof / Screenshots (recommended)</label>
        <div className="flex items-center gap-3 flex-wrap">
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-indigo-400 transition-colors text-sm text-gray-500 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Screenshot'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          {form.proof_urls.map((url, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">Proof {i + 1}</span>
              <button onClick={() => setForm(f => ({...f, proof_urls: f.proof_urls.filter((_, j) => j !== i)}))}
                className="text-red-400 hover:text-red-600 ml-1 text-xs">×</button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Screenshots greatly increase approval speed. Max 5 files.</p>
      </div>

      <div className="p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        Claims with screenshot proof are approved <strong>3× faster</strong>. You'll get an email notification within 24–48 hours.
      </div>

      <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        onClick={() => submitMutation.mutate(form)}
        disabled={!form.item_name || !form.description || submitMutation.isPending}>
        {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
        Submit Claim
      </Button>
    </div>
  );
}