import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Bot, AlertCircle, CheckCircle, Clock, Scale, FileText, ChevronRight, DollarSign, ShieldAlert, User } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_OPTIONS = [
  { value: 'billing', label: 'Billing / Payment Issue' },
  { value: 'payout_dispute', label: 'Payout Dispute' },
  { value: 'fraud_flag', label: 'Fraud Flag / Account Suspension' },
  { value: 'revenue_discrepancy', label: 'Revenue Discrepancy' },
  { value: 'install_fraud', label: 'Install Fraud Accusation' },
  { value: 'account', label: 'Account Access Issue' },
];

const STATUS_CONFIG = {
  open: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Open' },
  in_progress: { color: 'bg-amber-100 text-amber-700', icon: Bot, label: 'AI Reviewing' },
  resolved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Resolved' },
  closed: { color: 'bg-gray-100 text-gray-600', icon: CheckCircle, label: 'Closed' },
};

const RESOLUTION_CONFIG = {
  approve_full: { color: 'text-green-600', label: '✅ Full Approval', bg: 'bg-green-50' },
  approve_partial: { color: 'text-amber-600', label: '⚖️ Partial Approval', bg: 'bg-amber-50' },
  deny: { color: 'text-red-600', label: '❌ Denied', bg: 'bg-red-50' },
  escalate: { color: 'text-purple-600', label: '🔺 Escalated to Admin', bg: 'bg-purple-50' },
  needs_more_info: { color: 'text-blue-600', label: '📋 More Info Needed', bg: 'bg-blue-50' },
};

function TicketCard({ ticket, onSelect }) {
  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const StatusIcon = statusCfg.icon;
  const aiAnalysis = ticket.ai_analysis || {};

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(ticket)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{ticket.subject}</p>
            <p className="text-xs text-gray-400 mt-0.5">#{ticket.id?.slice(-6).toUpperCase()} · {new Date(ticket.created_date).toLocaleDateString()}</p>
          </div>
          <Badge className={`${statusCfg.color} flex items-center gap-1 flex-shrink-0`}>
            <StatusIcon className="w-3 h-3" />{statusCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ticket.description}</p>
        {ticket.affected_amount > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <DollarSign className="w-3.5 h-3.5" />${ticket.affected_amount} in dispute
          </div>
        )}
        {aiAnalysis.resolution_type && (
          <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.bg} ${RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.color}`}>
            AI Verdict: {RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.label}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-gray-300 mt-2 ml-auto" />
      </CardContent>
    </Card>
  );
}

export default function DeveloperDisputeCenter() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [form, setForm] = useState({ subject: '', description: '', category: 'billing', affected_amount: '' });
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: ticketsRes, isLoading, refetch } = useQuery({
    queryKey: ['dev-disputes', user?.id],
    queryFn: () => base44.functions.invoke('aiDisputeResolver', { action: 'list' }),
    enabled: !!user,
    select: r => r.data.tickets || [],
  });

  const tickets = ticketsRes || [];

  const handleSubmit = async () => {
    if (!form.subject || !form.description) return toast.error('Please fill in all fields');
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('aiDisputeResolver', {
        action: 'submit',
        ...form,
        affected_amount: parseFloat(form.affected_amount) || 0,
      });
      toast.success('Dispute submitted! AI is analyzing...');
      setShowForm(false);
      setForm({ subject: '', description: '', category: 'billing', affected_amount: '' });
      refetch();
      setSelectedTicket({ id: res.data.ticket_id, ai_analysis: res.data.ai_analysis, subject: form.subject, description: form.description, status: 'in_progress', created_date: new Date().toISOString(), affected_amount: parseFloat(form.affected_amount) || 0 });
    } catch {
      toast.error('Failed to submit dispute');
    }
    setSubmitting(false);
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>;

  const aiAnalysis = selectedTicket?.ai_analysis || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Scale className="w-7 h-7 text-red-600" /> Developer Dispute Center
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered dispute resolution for payouts, fraud flags & account issues</p>
          </div>
          <Button onClick={() => { setShowForm(true); setSelectedTicket(null); }} className="bg-red-600 hover:bg-red-700 gap-2">
            <Plus className="w-4 h-4" /> Submit Dispute
          </Button>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: FileText, label: 'Submit Ticket', desc: 'Describe your issue & evidence', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: Bot, label: 'AI Analysis', desc: 'AI reviews transactions & history', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: CheckCircle, label: 'Resolution', desc: 'Fair verdict with action steps', color: 'text-green-600', bg: 'bg-green-50' },
          ].map((step, i) => (
            <div key={i} className={`${step.bg} rounded-xl p-3 text-center`}>
              <step.icon className={`w-6 h-6 ${step.color} mx-auto mb-1`} />
              <p className="text-xs font-bold text-gray-800">{step.label}</p>
              <p className="text-xs text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Submit Form */}
        {showForm && (
          <Card className="border-2 border-red-200 shadow-md">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-600" /> New Dispute Ticket</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Category</p>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Amount in Dispute ($)</p>
                  <Input type="number" placeholder="0.00" value={form.affected_amount} onChange={e => setForm(f => ({ ...f, affected_amount: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Subject</p>
                <Input placeholder="Brief summary of your dispute" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Detailed Description</p>
                <Textarea placeholder="Describe the issue in detail. Include dates, amounts, transaction IDs, and any relevant context..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm h-28" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 gap-1" onClick={handleSubmit} disabled={submitting || !form.subject || !form.description}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  Submit for AI Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Ticket List */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Your Dispute Tickets ({tickets.length})</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : tickets.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center">
                  <Scale className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No disputes submitted yet.</p>
                </CardContent>
              </Card>
            ) : (
              tickets.map(t => <TicketCard key={t.id} ticket={t} onSelect={setSelectedTicket} />)
            )}
          </div>

          {/* AI Analysis Panel */}
          {selectedTicket && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">AI Analysis — #{selectedTicket.id?.slice(-6).toUpperCase()}</p>

              <Card className="border-0 shadow-md">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    <p className="text-sm font-bold text-gray-900">{selectedTicket.subject}</p>
                  </div>

                  {aiAnalysis.resolution_type ? (
                    <>
                      {/* Validity Score */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl text-center">
                          <p className="text-xs text-gray-500">Validity Score</p>
                          <p className={`text-2xl font-black mt-1 ${aiAnalysis.validity_score >= 70 ? 'text-green-600' : aiAnalysis.validity_score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                            {aiAnalysis.validity_score}<span className="text-sm text-gray-400">/100</span>
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl text-center">
                          <p className="text-xs text-gray-500">Est. Resolution</p>
                          <p className="text-2xl font-black text-blue-600 mt-1">
                            {aiAnalysis.estimated_resolution_days}<span className="text-sm text-gray-400">d</span>
                          </p>
                        </div>
                      </div>

                      {/* Verdict */}
                      <div className={`p-3 rounded-xl ${RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.bg}`}>
                        <p className={`text-sm font-bold ${RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.color}`}>
                          {RESOLUTION_CONFIG[aiAnalysis.resolution_type]?.label}
                        </p>
                        {aiAnalysis.resolution_amount > 0 && (
                          <p className="text-xs text-gray-600 mt-1">Resolution Amount: <strong>${aiAnalysis.resolution_amount}</strong></p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">{aiAnalysis.resolution_explanation}</p>
                      </div>

                      {/* Root Cause */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Root Cause Analysis</p>
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">{aiAnalysis.root_cause}</p>
                      </div>

                      {/* Risk Flag */}
                      {aiAnalysis.risk_flag && (
                        <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-600">{aiAnalysis.risk_reason}</p>
                        </div>
                      )}

                      {/* Steps */}
                      {aiAnalysis.resolution_steps?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Resolution Steps</p>
                          <div className="space-y-1.5">
                            {aiAnalysis.resolution_steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <div className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin flag */}
                      {aiAnalysis.admin_action_required && (
                        <div className="flex items-start gap-2 p-2 bg-purple-50 rounded-lg">
                          <User className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-purple-700">Admin Intervention Required</p>
                            <p className="text-xs text-purple-600">{aiAnalysis.admin_instructions}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">AI is analyzing your dispute...</p>
                        <p className="text-xs text-purple-500">This usually takes 30–60 seconds</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}