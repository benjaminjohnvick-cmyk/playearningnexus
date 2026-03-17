import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, Upload, FileText, Clock, CheckCircle2,
  XCircle, RefreshCw, Plus, Image as ImageIcon, Loader2,
  ChevronDown, ChevronUp, Search, Zap, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_CFG = {
  pending:   { label: 'Submitted',  color: 'bg-blue-100 text-blue-700',    icon: Clock,        dot: 'bg-blue-400' },
  reviewing: { label: 'In Review',  color: 'bg-amber-100 text-amber-700',  icon: RefreshCw,    dot: 'bg-amber-400' },
  approved:  { label: 'Approved',   color: 'bg-green-100 text-green-700',  icon: CheckCircle2, dot: 'bg-green-500' },
  rejected:  { label: 'Rejected',   color: 'bg-red-100 text-red-700',      icon: XCircle,      dot: 'bg-red-400' },
};

const STEPS = ['Submitted', 'Under Review', 'Decision Made', 'Resolved'];

function DisputeStatusTracker({ dispute }) {
  const stepIndex =
    dispute.status === 'pending'   ? 0 :
    dispute.status === 'reviewing' ? 1 :
    dispute.status === 'approved' || dispute.status === 'rejected' ? 2 : 3;

  return (
    <div className="flex items-center gap-0 mt-3">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i <= stepIndex ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 text-center leading-tight max-w-14 ${i <= stepIndex ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < stepIndex ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function DisputeCard({ dispute }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[dispute.status] || STATUS_CFG.pending;
  const Icon = cfg.icon;

  return (
    <div className="border-2 border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
      <button className="w-full flex items-start justify-between p-4 text-left gap-3" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color.split(' ')[0]}`}>
            <Icon className={`w-4 h-4 ${cfg.color.split(' ')[1]} ${dispute.status === 'reviewing' ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{dispute.survey_title || 'Survey Dispute'}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge className={`text-xs ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1 inline-block`} />
                {cfg.label}
              </Badge>
              {dispute.expected_amount && (
                <span className="text-xs text-green-600 font-medium">Expected: ${dispute.expected_amount}</span>
              )}
              {dispute.transaction_id && (
                <span className="text-xs font-mono text-gray-400 truncate">TxID: {dispute.transaction_id.slice(0, 12)}...</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {dispute.created_date ? formatDistanceToNow(new Date(dispute.created_date), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <DisputeStatusTracker dispute={dispute} />

          {dispute.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Your Description</p>
              <p className="text-xs text-gray-700 bg-white rounded-lg p-2 border border-gray-200">{dispute.description}</p>
            </div>
          )}

          {dispute.screenshot_url && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Screenshot</p>
              <a href={dispute.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={dispute.screenshot_url} alt="proof" className="h-20 w-auto rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors" />
              </a>
            </div>
          )}

          {dispute.admin_notes && (
            <div className={`p-2 rounded-lg border text-xs ${
              dispute.status === 'approved' ? 'bg-green-50 border-green-200 text-green-700' :
              dispute.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <strong>Admin note:</strong> {dispute.admin_notes}
            </div>
          )}

          {dispute.status === 'approved' && dispute.resolved_amount > 0 && (
            <div className="bg-green-100 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-green-700">✅ Credited ${dispute.resolved_amount.toFixed(2)} to your balance</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SelfServiceDisputeModule({ user }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('history'); // 'history' | 'new'
  const [step, setStep] = useState(1); // 1=select tx, 2=details, 3=confirm
  const [selectedTx, setSelectedTx] = useState(null);
  const [txSearch, setTxSearch] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: disputes = [], isLoading: loadingDisputes } = useQuery({
    queryKey: ['self-service-disputes', user?.id],
    queryFn: () => base44.entities.SurveyDispute.filter({ user_id: user.id }, '-created_date', 30),
    enabled: !!user,
  });

  const { data: transactions = [], isLoading: loadingTxs } = useQuery({
    queryKey: ['user-ppc-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user && view === 'new',
  });

  const filteredTxs = transactions.filter(tx => {
    const q = txSearch.toLowerCase();
    return !q || (tx.description || '').toLowerCase().includes(q) || tx.id.toLowerCase().includes(q);
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File must be under 5MB');
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setScreenshotUrl(file_url);
    setUploading(false);
    toast.success('Screenshot uploaded!');
  };

  const handleSubmit = async () => {
    if (!description.trim()) return toast.error('Please describe the issue');
    setSubmitting(true);

    await base44.entities.SurveyDispute.create({
      user_id: user.id,
      survey_title: selectedTx?.description || 'Transaction Dispute',
      provider: 'bitlabs',
      expected_amount: selectedTx?.amount,
      description,
      screenshot_url: screenshotUrl || null,
      transaction_id: selectedTx?.id || null,
      transaction_date: selectedTx?.created_date ? selectedTx.created_date.split('T')[0] : null,
      status: 'pending',
    });

    setSubmitting(false);
    queryClient.invalidateQueries(['self-service-disputes', user?.id]);
    toast.success('Dispute submitted! Real-time updates will appear in your dispute history.');

    // Reset
    setView('history');
    setStep(1);
    setSelectedTx(null);
    setDescription('');
    setScreenshotUrl('');
    setTxSearch('');
  };

  const resetForm = () => {
    setStep(1); setSelectedTx(null); setDescription('');
    setScreenshotUrl(''); setTxSearch(''); setView('history');
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" /> Dispute Center
            {disputes.filter(d => d.status === 'reviewing').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => { setView('history'); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${view === 'history' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" /> My Disputes ({disputes.length})
            </button>
            <button
              onClick={() => { setView('new'); setStep(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${view === 'new' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" /> New Dispute
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'history' && (
          <>
            {loadingDisputes ? (
              <div className="text-center py-10"><Loader2 className="w-7 h-7 animate-spin text-gray-300 mx-auto" /></div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-medium">No disputes filed yet</p>
                <p className="text-xs mt-1">Click "New Dispute" to report a missing transaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map(d => <DisputeCard key={d.id} dispute={d} />)}
              </div>
            )}
          </>
        )}

        {view === 'new' && (
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-0">
              {['Select Transaction', 'Describe Issue', 'Confirm'].map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i + 1 <= step ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{i + 1 < step ? '✓' : i + 1}</div>
                    <span className={`text-xs mt-1 hidden sm:block ${i + 1 <= step ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{s}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mb-3 mx-1 ${i + 1 < step ? 'bg-red-400' : 'bg-gray-200'}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Select transaction */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Select the missing/incorrect transaction:</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={txSearch}
                    onChange={e => setTxSearch(e.target.value)}
                    className="pl-9 border-2 h-9 text-sm"
                  />
                </div>
                {loadingTxs ? (
                  <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" /></div>
                ) : filteredTxs.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <p>No transactions found.</p>
                    <button onClick={() => setStep(2)} className="text-blue-600 underline text-xs mt-2">
                      Skip — dispute without selecting a transaction
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredTxs.map(tx => (
                      <button
                        key={tx.id}
                        onClick={() => { setSelectedTx(tx); setStep(2); }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all hover:border-red-300 hover:bg-red-50 ${
                          selectedTx?.id === tx.id ? 'border-red-500 bg-red-50' : 'border-gray-100'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{tx.description || tx.transaction_type}</p>
                          <p className="text-xs text-gray-400 font-mono">ID: {tx.id.slice(0, 16)}...</p>
                          {tx.created_date && <p className="text-xs text-gray-400">{format(new Date(tx.created_date), 'MMM d, yyyy')}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount || 0).toFixed(2)}
                          </p>
                          <Badge className="text-xs bg-gray-100 text-gray-600">{tx.transaction_type}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              </div>
            )}

            {/* Step 2: Describe issue */}
            {step === 2 && (
              <div className="space-y-3">
                {selectedTx && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
                    <p className="font-semibold text-blue-800 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Selected Transaction</p>
                    <p className="text-blue-700 mt-1">{selectedTx.description || selectedTx.transaction_type} — <strong>${selectedTx.amount?.toFixed(2)}</strong></p>
                    <p className="font-mono text-blue-600 mt-0.5">TxID: {selectedTx.id}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Describe the issue *</label>
                  <textarea
                    placeholder="e.g. I completed this survey/session but the credit was not added to my balance..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-red-400 placeholder:text-gray-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Upload Screenshot (optional but recommended)</label>
                  {screenshotUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                      <img src={screenshotUrl} alt="proof" className="w-14 h-10 object-cover rounded-lg border" />
                      <div>
                        <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Uploaded
                        </p>
                        <button onClick={() => setScreenshotUrl('')} className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-red-300 hover:bg-red-50 transition-all">
                      {uploading ? <Loader2 className="w-7 h-7 text-red-400 animate-spin mb-2" /> : <ImageIcon className="w-7 h-7 text-gray-300 mb-2" />}
                      <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Click to upload screenshot'}</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Disputes with screenshots are resolved 3× faster. You'll receive real-time status updates here.
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setStep(3)} disabled={!description.trim()} className="flex-1 bg-red-600 hover:bg-red-700">
                    Review & Submit
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)} className="px-5">Back</Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
                  <p className="font-bold text-gray-800">Dispute Summary</p>
                  {selectedTx && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Transaction</span>
                      <span className="font-mono text-gray-700">{selectedTx.id.slice(0, 20)}...</span>
                    </div>
                  )}
                  {selectedTx?.amount && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Amount</span>
                      <span className="text-green-600 font-bold">${selectedTx.amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Screenshot</span>
                    <span className={screenshotUrl ? 'text-green-600' : 'text-amber-600'}>{screenshotUrl ? '✅ Included' : '⚠️ Not included'}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Your description:</p>
                    <p className="text-xs text-gray-700">{description}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-red-600 hover:bg-red-700">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : <><Upload className="w-4 h-4 mr-2" /> Submit Dispute</>}
                  </Button>
                  <Button variant="outline" onClick={() => setStep(2)} className="px-5">Back</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}