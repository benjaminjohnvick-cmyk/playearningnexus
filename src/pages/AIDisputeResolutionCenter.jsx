import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Shield, Upload, Bot, CheckCircle, XCircle, Clock, FileText, DollarSign, RefreshCw, AlertTriangle, Loader2, History } from 'lucide-react';
import { toast } from 'sonner';
import EvidenceReviewDashboard from '@/components/disputes/EvidenceReviewDashboard';

const DISPUTE_TYPES = [
  { id: 'missing_survey_payment', label: 'Missing Survey Payment', icon: '📋', estimatedPayout: '$2–$15' },
  { id: 'missing_referral_commission', label: 'Missing Referral Commission', icon: '👥', estimatedPayout: '$0.25–$50' },
  { id: 'incorrect_amount', label: 'Incorrect Payout Amount', icon: '💰', estimatedPayout: 'Varies' },
  { id: 'referral_not_credited', label: 'Referral Not Credited', icon: '🔗', estimatedPayout: '$5–$25' },
  { id: 'survey_completed_no_credit', label: 'Survey Completed — No Credit', icon: '✅', estimatedPayout: '$1–$10' },
];

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
  analyzing: { label: 'AI Analyzing', color: 'bg-purple-100 text-purple-700', icon: Bot },
  auto_approved: { label: 'Auto-Approved ✅', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-700', icon: XCircle },
  pending_human: { label: 'Human Review', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
};

export default function AIDisputeResolutionCenter() {
  const [user, setUser] = useState(null);
  const [disputeType, setDisputeType] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [submittedDisputeId, setSubmittedDisputeId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: myDisputes = [] } = useQuery({
    queryKey: ['myAIDisputes', user?.id],
    queryFn: () => base44.entities.AffiliateDispute.filter({ affiliate_user_id: user.id }, '-created_date', 20),
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['recentTxns', user?.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
        toast.success(`Uploaded: ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploadedUrls(prev => [...prev, ...urls]);
    setEvidenceFiles(prev => [...prev, ...files]);
    setUploading(false);
  };

  const handleSubmitDispute = async () => {
    if (!disputeType || !description) {
      toast.error('Please fill in dispute type and description');
      return;
    }
    setSubmitting(true);
    try {
      const dispute = await base44.entities.AffiliateDispute.create({
        affiliate_user_id: user.id,
        affiliate_email: user.email,
        dispute_type: disputeType,
        description,
        amount_disputed: parseFloat(amount) || 0,
        transaction_id: transactionId,
        proof_urls: uploadedUrls,
        status: 'submitted',
        timeline: [{ event: 'Dispute submitted by user', timestamp: new Date().toISOString(), actor: user.email }],
      });
      setSubmittedDisputeId(dispute.id);
      toast.success('Dispute submitted! AI analysis starting...');

      // Immediately trigger AI analysis
      setAnalyzing(true);
      await runAIAnalysis(dispute.id, dispute);
    } catch (e) {
      toast.error('Submission failed. Please try again.');
    }
    setSubmitting(false);
  };

  const runAIAnalysis = async (disputeId, disputeData) => {
    setAnalyzing(true);
    setResolution(null);
    try {
      // Fetch relevant transactions for context
      const relevantTxns = transactions.slice(0, 20);
      const txnSummary = relevantTxns.map(t =>
        `[${t.type || 'txn'}] $${t.amount} — ${t.description || ''} — ${t.status} — ${new Date(t.created_date).toLocaleDateString()}`
      ).join('\n');

      const prompt = `You are an AI dispute resolution analyst for GamerGain, a platform where users earn money through surveys, referrals, and games.

USER DISPUTE:
- Type: ${disputeData?.dispute_type || disputeType}
- Description: ${disputeData?.description || description}
- Amount claimed: $${disputeData?.amount_disputed || amount || 'Not specified'}
- Transaction ID: ${disputeData?.transaction_id || transactionId || 'Not provided'}
- Evidence files uploaded: ${(disputeData?.proof_urls || uploadedUrls).length} file(s)

RECENT TRANSACTION LOG (last 20):
${txnSummary || 'No transactions found'}

PLATFORM RULES:
- Survey payments: $1–$15 per survey, paid when trust_score >= 60
- Referral commissions: $0.25 per MLM level, $5 direct bonus when referred user hits $8
- Payouts processed within 48 hours of threshold ($10 minimum)

TASK:
1. Analyze if the claim appears valid based on the description, evidence count, and transaction log
2. Calculate the estimated payout amount if valid
3. Decide: auto_approve (high confidence valid), deny (clear evidence it was paid or invalid), or pending_human (needs manual review)
4. Provide a clear, human-readable explanation

Respond as JSON:
{
  "decision": "auto_approve" | "deny" | "pending_human",
  "confidence": 0-100,
  "estimated_payout": number,
  "explanation": "clear explanation for the user (2-3 sentences)",
  "evidence_strength": "strong" | "moderate" | "weak",
  "admin_notes": "internal notes for admin review if needed",
  "matching_transactions": "any transaction IDs or patterns found"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            confidence: { type: 'number' },
            estimated_payout: { type: 'number' },
            explanation: { type: 'string' },
            evidence_strength: { type: 'string' },
            admin_notes: { type: 'string' },
            matching_transactions: { type: 'string' },
          },
        },
      });

      const finalStatus = result.decision === 'auto_approve' ? 'auto_approved' :
                          result.decision === 'deny' ? 'denied' : 'pending_human';

      await base44.entities.AffiliateDispute.update(disputeId || submittedDisputeId, {
        status: finalStatus,
        ai_analysis: {
          validity_score: result.confidence,
          evidence_strength: result.evidence_strength,
          recommended_action: result.decision,
          analysis_notes: result.explanation,
          similar_cases: 0,
          pattern_match: result.matching_transactions,
        },
        settlement_offer: result.decision === 'auto_approve' ? {
          offered_amount: result.estimated_payout,
          offer_basis: 'AI auto-analysis',
          ai_confidence: result.confidence,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        } : null,
        timeline: [
          { event: 'Dispute submitted', timestamp: new Date(Date.now() - 2000).toISOString(), actor: user.email },
          { event: `AI analysis complete — ${finalStatus}`, timestamp: new Date().toISOString(), actor: 'AI System' },
        ],
      });

      // Auto-pay if approved
      if (result.decision === 'auto_approve' && result.estimated_payout > 0) {
        await base44.auth.updateMe({
          total_earnings: (user.total_earnings || 0) + result.estimated_payout,
        });
        await base44.entities.Transaction.create({
          user_id: user.id,
          type: 'dispute_resolution_payout',
          amount: result.estimated_payout,
          description: `AI Dispute Resolution: ${disputeType}`,
          status: 'completed',
        });
      }

      setResolution({ ...result, status: finalStatus });
      queryClient.invalidateQueries({ queryKey: ['myAIDisputes'] });
    } catch (e) {
      toast.error('AI analysis failed. Your dispute was saved for manual review.');
    }
    setAnalyzing(false);
  };

  const resetForm = () => {
    setDisputeType(''); setDescription(''); setAmount('');
    setTransactionId(''); setEvidenceFiles([]); setUploadedUrls([]);
    setResolution(null); setSubmittedDisputeId(null);
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black mb-1">AI Dispute Resolution Center</h1>
              <p className="text-indigo-200">Submit evidence for missing payments. AI analyzes your claim against transaction logs and auto-resolves in seconds.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: Upload, label: 'Upload Evidence', desc: 'Screenshots, logs, receipts' },
              { icon: Bot, label: 'AI Analysis', desc: 'Cross-checked vs transaction logs' },
              { icon: DollarSign, label: 'Auto-Payout', desc: 'Approved claims paid instantly' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-1 text-indigo-200" />
                <p className="text-xs font-bold">{s.label}</p>
                <p className="text-xs text-indigo-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <Tabs defaultValue="submit">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="submit" className="flex-1">📝 Submit Claim</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">📜 My Claims ({myDisputes.length})</TabsTrigger>
            {user?.role === 'admin' && <TabsTrigger value="pending_human" className="flex-1">👤 Human Review ({myDisputes.filter(d => d.status === 'pending_human').length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="submit">
            {resolution ? (
              /* Resolution Result */
              <Card className={`border-2 ${resolution.status === 'auto_approved' ? 'border-green-400' : resolution.status === 'denied' ? 'border-red-300' : 'border-yellow-300'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {resolution.status === 'auto_approved' ? <CheckCircle className="w-7 h-7 text-green-600" /> :
                     resolution.status === 'denied' ? <XCircle className="w-7 h-7 text-red-500" /> :
                     <AlertTriangle className="w-7 h-7 text-yellow-600" />}
                    AI Resolution Proposal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Decision badge */}
                  <div className={`rounded-xl p-5 ${resolution.status === 'auto_approved' ? 'bg-green-50 border-2 border-green-200' : resolution.status === 'denied' ? 'bg-red-50 border-2 border-red-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <Badge className={STATUS_CONFIG[resolution.status]?.color + ' text-sm px-3 py-1'}>
                        {STATUS_CONFIG[resolution.status]?.label}
                      </Badge>
                      <span className="text-sm font-bold text-gray-600">AI Confidence: {resolution.confidence}%</span>
                    </div>
                    <p className="text-gray-800 font-medium leading-relaxed">{resolution.explanation}</p>
                  </div>

                  {/* Payout detail */}
                  {resolution.status === 'auto_approved' && resolution.estimated_payout > 0 && (
                    <div className="bg-green-600 rounded-xl p-5 text-white text-center">
                      <DollarSign className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-3xl font-black">${resolution.estimated_payout.toFixed(2)}</p>
                      <p className="text-green-100 text-sm mt-1">Added to your earnings balance immediately</p>
                    </div>
                  )}

                  {/* Evidence strength */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3 border">
                      <p className="text-gray-500 text-xs mb-1">Evidence Strength</p>
                      <p className="font-bold capitalize text-gray-800">{resolution.evidence_strength}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border">
                      <p className="text-gray-500 text-xs mb-1">Matching Transactions</p>
                      <p className="font-bold text-gray-800 text-xs truncate">{resolution.matching_transactions || 'None found'}</p>
                    </div>
                  </div>

                  {resolution.status === 'pending_human' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                      <p className="font-bold mb-1">⏳ Escalated to Human Review</p>
                      <p>Our support team will review your claim within 24–48 hours. You'll receive an email notification when a decision is made.</p>
                    </div>
                  )}

                  <Button onClick={resetForm} variant="outline" className="w-full">
                    Submit Another Claim
                  </Button>
                </CardContent>
              </Card>
            ) : analyzing ? (
              <Card className="border-2 border-purple-200">
                <CardContent className="p-12 text-center">
                  <Bot className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-xl font-black text-gray-900 mb-2">AI Analyzing Your Claim</h3>
                  <p className="text-gray-500 text-sm mb-6">Cross-referencing evidence against your transaction history...</p>
                  <div className="space-y-2 text-left max-w-sm mx-auto">
                    {['Parsing uploaded evidence...', 'Scanning transaction logs...', 'Calculating estimated payout...', 'Generating resolution proposal...'].map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500 flex-shrink-0" />
                        <span className="text-gray-600">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                {/* Dispute Type */}
                <Card className="border-2">
                  <CardHeader><CardTitle className="text-base">1. Select Dispute Type</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {DISPUTE_TYPES.map(dt => (
                        <button key={dt.id} onClick={() => setDisputeType(dt.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${disputeType === dt.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xl">{dt.icon}</span>
                            <Badge className="bg-gray-100 text-gray-600 text-xs">{dt.estimatedPayout}</Badge>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{dt.label}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Details */}
                <Card className="border-2">
                  <CardHeader><CardTitle className="text-base">2. Claim Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Describe what happened *</label>
                      <textarea
                        className="w-full border-2 rounded-xl px-4 py-3 text-sm min-h-[100px] resize-none focus:outline-none focus:border-purple-400"
                        placeholder="E.g. I completed the TechCorp survey on May 15th and was not credited the $5.00 reward. My survey ID was XXXX..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Amount Claimed ($)</label>
                        <input className="w-full border-2 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-400"
                          placeholder="e.g. 5.00" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Transaction / Survey ID (optional)</label>
                        <input className="w-full border-2 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-400"
                          placeholder="e.g. TXN-12345" value={transactionId} onChange={e => setTransactionId(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Upload */}
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-600" /> 3. Upload Evidence
                      <Badge className="bg-purple-100 text-purple-700 text-xs">Boosts approval odds 5×</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="block">
                      <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${uploading ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'}`}>
                        {uploading ? (
                          <><Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" /><p className="text-sm text-gray-600">Uploading...</p></>
                        ) : (
                          <><Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-700">Click to upload screenshots or logs</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF, TXT — max 10MB each</p></>
                        )}
                      </div>
                      <input type="file" multiple accept="image/*,.pdf,.txt,.log" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    {uploadedUrls.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {evidenceFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="font-medium text-green-800 truncate">{f.name}</span>
                            <span className="text-green-600 text-xs ml-auto">Uploaded</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submit */}
                <Button
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black h-14 text-base"
                  onClick={handleSubmitDispute}
                  disabled={submitting || !disputeType || !description}
                >
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Submitting...</> :
                    <><Bot className="w-5 h-5 mr-2" />Submit & Get AI Resolution Proposal</>}
                </Button>
                <p className="text-xs text-center text-gray-500">AI analyzes your claim in real-time. High-confidence valid claims are auto-approved and paid instantly.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {myDisputes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No disputes submitted yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myDisputes.map(d => {
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.submitted;
                  const Icon = cfg.icon;
                  return (
                    <Card key={d.id} className="border-2">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <p className="font-black text-gray-900 capitalize">{(d.dispute_type || '').replace(/_/g, ' ')}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{new Date(d.created_date).toLocaleDateString()}</p>
                          </div>
                          <Badge className={cfg.color + ' flex items-center gap-1'}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{d.description}</p>
                        {d.ai_analysis?.analysis_notes && (
                          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-800">
                            <p className="font-bold mb-1">🤖 AI Analysis</p>
                            <p>{d.ai_analysis.analysis_notes}</p>
                          </div>
                        )}
                        {d.settlement_offer?.offered_amount > 0 && d.status === 'auto_approved' && (
                          <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                            <p className="text-green-700 font-black text-lg">${d.settlement_offer.offered_amount.toFixed(2)} Paid ✅</p>
                          </div>
                        )}
                        {(d.status === 'submitted' || d.status === 'pending_human' || d.status === 'under_review') && (
                          <div className="mt-3">
                            <EvidenceReviewDashboard
                              dispute={d}
                              isAdmin={user?.role === 'admin'}
                              onResolved={() => queryClient.invalidateQueries({ queryKey: ['myAIDisputes'] })}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {user?.role === 'admin' && (
            <TabsContent value="pending_human">
              <div className="space-y-4">
                {myDisputes.filter(d => d.status === 'pending_human').length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No disputes awaiting human review</p>
                  </div>
                ) : myDisputes.filter(d => d.status === 'pending_human').map(d => (
                  <Card key={d.id} className="border-2 border-yellow-300">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div>
                          <p className="font-black text-gray-900 capitalize">{(d.dispute_type || '').replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-500">{d.affiliate_email} · ${d.amount_disputed}</p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-700">👤 Awaiting Human Review</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{d.description}</p>
                      <EvidenceReviewDashboard dispute={d} isAdmin={true}
                        onResolved={() => queryClient.invalidateQueries({ queryKey: ['myAIDisputes'] })} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}