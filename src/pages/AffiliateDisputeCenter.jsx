import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Clock, CheckCircle, XCircle, AlertTriangle, DollarSign, FileText, Zap } from 'lucide-react';

const STATUS_CONFIG = {
  submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Submitted' },
  under_review: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Under Review' },
  ai_analyzed: { color: 'bg-purple-100 text-purple-800', icon: Zap, label: 'AI Analyzed' },
  settlement_offered: { color: 'bg-green-100 text-green-800', icon: DollarSign, label: 'Settlement Offered' },
  accepted: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Accepted' },
  rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
  escalated: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, label: 'Escalated' },
  resolved: { color: 'bg-slate-100 text-slate-800', icon: CheckCircle, label: 'Resolved' }
};

export default function AffiliateDisputeCenter() {
  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [form, setForm] = useState({ dispute_type: '', amount_disputed: '', description: '', transaction_id: '' });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['affiliateDisputes'],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.AffiliateDispute.filter({ affiliate_user_id: user.id }, '-created_date', 50);
    },
    enabled: !!user
  });

  const submitMutation = useMutation({
    mutationFn: async (data) => base44.entities.AffiliateDispute.create(data),
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['affiliateDisputes'] });
      setSelectedDispute(dispute);
      setView('detail');
      setForm({ dispute_type: '', amount_disputed: '', description: '', transaction_id: '' });
      setUploadedFiles([]);
    }
  });

  const settlementMutation = useMutation({
    mutationFn: async ({ dispute_id, action }) => {
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      const resolved_amount = action === 'accept' ? selectedDispute.settlement_offer?.offered_amount : 0;
      return base44.entities.AffiliateDispute.update(dispute_id, {
        status: newStatus,
        resolved_amount,
        resolved_at: new Date().toISOString(),
        timeline: [
          ...(selectedDispute.timeline || []),
          { event: action === 'accept' ? 'Settlement Accepted' : 'Settlement Rejected', timestamp: new Date().toISOString(), actor: user?.email }
        ]
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['affiliateDisputes'] })
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setUploadedFiles(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    submitMutation.mutate({
      affiliate_user_id: user.id,
      affiliate_email: user.email,
      dispute_type: form.dispute_type,
      amount_disputed: parseFloat(form.amount_disputed) || 0,
      description: form.description,
      transaction_id: form.transaction_id,
      proof_urls: uploadedFiles,
      status: 'submitted',
      timeline: [{ event: 'Dispute Submitted', timestamp: new Date().toISOString(), actor: user.email }]
    });
  };

  const triggerAIAnalysis = async (dispute) => {
    setAnalyzing(true);
    try {
      await base44.functions.invoke('analyzeAffiliateDispute', { dispute_id: dispute.id });
      queryClient.invalidateQueries({ queryKey: ['affiliateDisputes'] });
      const updated = await base44.entities.AffiliateDispute.filter({ id: dispute.id });
      if (updated[0]) setSelectedDispute(updated[0]);
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  };

  if (view === 'new') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('list')} className="text-blue-600 hover:underline mb-4 block">← Back to Disputes</button>
          <Card>
            <CardHeader>
              <CardTitle>Submit New Dispute</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Dispute Type *</label>
                  <Select value={form.dispute_type} onValueChange={v => setForm({ ...form, dispute_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dispute type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="missing_payout">Missing Payout</SelectItem>
                      <SelectItem value="incorrect_amount">Incorrect Amount</SelectItem>
                      <SelectItem value="referral_not_credited">Referral Not Credited</SelectItem>
                      <SelectItem value="fraud_accusation">Fraud Accusation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Transaction ID (if applicable)</label>
                  <Input placeholder="e.g. txn_abc123" value={form.transaction_id} onChange={e => setForm({ ...form, transaction_id: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Amount Disputed ($)</label>
                  <Input type="number" placeholder="0.00" value={form.amount_disputed} onChange={e => setForm({ ...form, amount_disputed: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Description *</label>
                  <textarea
                    className="w-full border rounded-md p-3 text-sm"
                    rows={5}
                    placeholder="Describe the issue in detail..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Upload Proof</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center mt-2">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 mb-2">Upload screenshots, emails, or documents</p>
                    <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="proof-upload" />
                    <label htmlFor="proof-upload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md text-sm">
                      {uploading ? 'Uploading...' : 'Choose Files'}
                    </label>
                    {uploadedFiles.length > 0 && (
                      <p className="mt-2 text-sm text-green-600">{uploadedFiles.length} file(s) uploaded</p>
                    )}
                  </div>
                </div>
                <Button type="submit" className="w-full bg-blue-600" disabled={submitMutation.isPending || !form.dispute_type || !form.description}>
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedDispute) {
    const sc = STATUS_CONFIG[selectedDispute.status] || STATUS_CONFIG.submitted;
    const Icon = sc.icon;
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setView('list')} className="text-blue-600 hover:underline mb-4 block">← Back to Disputes</button>
          <div className="grid gap-6">
            {/* Status Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Dispute #{selectedDispute.id?.slice(-6).toUpperCase()}</CardTitle>
                  <Badge className={sc.color}><Icon className="w-3 h-3 mr-1" />{sc.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500">Type:</span> <span className="font-medium">{selectedDispute.dispute_type?.replace(/_/g, ' ')}</span></div>
                  <div><span className="text-slate-500">Amount:</span> <span className="font-medium text-red-600">${selectedDispute.amount_disputed}</span></div>
                  <div className="col-span-2"><span className="text-slate-500">Description:</span> <p className="mt-1">{selectedDispute.description}</p></div>
                </div>
                {selectedDispute.proof_urls?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-500 mb-2">{selectedDispute.proof_urls.length} proof file(s) uploaded</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedDispute.proof_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                          📎 File {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(selectedDispute.status === 'submitted' || selectedDispute.status === 'under_review') && (
                  <Button className="mt-4 bg-purple-600" onClick={() => triggerAIAnalysis(selectedDispute)} disabled={analyzing}>
                    <Zap className="w-4 h-4 mr-2" />
                    {analyzing ? 'Analyzing...' : 'Request AI Analysis'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* AI Analysis */}
            {selectedDispute.ai_analysis && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-800"><Zap className="w-5 h-5" />AI Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div className="text-center"><p className="text-2xl font-bold text-purple-700">{selectedDispute.ai_analysis.validity_score}</p><p className="text-slate-500">Validity Score</p></div>
                    <div className="text-center"><p className="text-2xl font-bold capitalize text-purple-700">{selectedDispute.ai_analysis.evidence_strength}</p><p className="text-slate-500">Evidence</p></div>
                    <div className="text-center"><p className="text-2xl font-bold text-purple-700">{selectedDispute.ai_analysis.similar_cases}</p><p className="text-slate-500">Similar Cases</p></div>
                  </div>
                  <p className="text-sm text-slate-700 bg-white rounded p-3 border">{selectedDispute.ai_analysis.analysis_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Settlement Offer */}
            {selectedDispute.settlement_offer && selectedDispute.status === 'settlement_offered' && (
              <Card className="border-green-300 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2"><DollarSign className="w-5 h-5" />Settlement Offer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-700 mb-2">${selectedDispute.settlement_offer.offered_amount}</p>
                  <p className="text-sm text-slate-600 mb-1">{selectedDispute.settlement_offer.offer_basis}</p>
                  <p className="text-xs text-slate-500 mb-4">AI Confidence: {selectedDispute.settlement_offer.ai_confidence}% | Expires: {new Date(selectedDispute.settlement_offer.expires_at).toLocaleDateString()}</p>
                  <div className="flex gap-3">
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => settlementMutation.mutate({ dispute_id: selectedDispute.id, action: 'accept' })}>
                      ✓ Accept Settlement
                    </Button>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => settlementMutation.mutate({ dispute_id: selectedDispute.id, action: 'reject' })}>
                      ✗ Reject & Escalate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {selectedDispute.timeline?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Activity Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedDispute.timeline.map((event, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{event.event}</p>
                          <p className="text-slate-500 text-xs">{new Date(event.timestamp).toLocaleString()} • {event.actor}</p>
                          {event.note && <p className="text-slate-600 mt-0.5">{event.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dispute Resolution Center</h1>
            <p className="text-slate-600">Track disputes, upload proof, and receive AI-powered settlements</p>
          </div>
          <Button className="bg-blue-600" onClick={() => setView('new')}>+ New Dispute</Button>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-500 py-12">Loading disputes...</div>
        ) : disputes.length === 0 ? (
          <Card className="text-center p-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No disputes filed yet</p>
            <Button className="bg-blue-600" onClick={() => setView('new')}>File Your First Dispute</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {disputes.map(dispute => {
              const sc = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.submitted;
              const Icon = sc.icon;
              return (
                <Card key={dispute.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedDispute(dispute); setView('detail'); }}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-slate-500">#{dispute.id?.slice(-6).toUpperCase()}</span>
                          <Badge className={sc.color}><Icon className="w-3 h-3 mr-1" />{sc.label}</Badge>
                          <span className="text-sm text-slate-500">{dispute.dispute_type?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm line-clamp-1">{dispute.description}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-lg text-red-600">${dispute.amount_disputed || 0}</p>
                        <p className="text-xs text-slate-500">{new Date(dispute.created_date).toLocaleDateString()}</p>
                        {dispute.settlement_offer && <p className="text-xs text-green-600">Offer: ${dispute.settlement_offer.offered_amount}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}