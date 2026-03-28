import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw, AlertTriangle, CheckCircle2, DollarSign, Mail,
  ChevronDown, ChevronUp, Loader2, BarChart2, Clock, Shield,
  FileText, Send, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const DISCREPANCY_TYPE_LABELS = {
  payout_exceeds_earnings: { label: 'Payout > Earnings', color: 'bg-orange-100 text-orange-700' },
  stripe_payout_unmatched: { label: 'Stripe Unmatched', color: 'bg-red-100 text-red-700' },
  completed_with_error: { label: 'Completed w/ Error', color: 'bg-amber-100 text-amber-700' },
  overall_sum_mismatch: { label: 'Sum Mismatch', color: 'bg-purple-100 text-purple-700' },
};

function DiscrepancyRow({ d, index, reportId, onResolved }) {
  const [resolving, setResolving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const cfg = DISCREPANCY_TYPE_LABELS[d.type] || { label: d.type, color: 'bg-gray-100 text-gray-700' };

  const markResolved = async () => {
    setResolving(true);
    // We can't patch array items directly, so we note it via toast for now
    // In production you'd update the parent report's discrepancies array
    toast.success('Marked as resolved (update the report record to persist)');
    setResolving(false);
    onResolved && onResolved(index);
  };

  const sendPartnerEmail = async () => {
    if (!d.user_email) return toast.error('No email address for this discrepancy');
    setEmailing(true);
    await base44.integrations.Core.SendEmail({
      to: d.user_email,
      subject: `Action Required: Payout Discrepancy Detected — $${d.delta.toFixed(2)}`,
      body: `
        <p>Dear Partner,</p>
        <p>Our automated reconciliation system has flagged a discrepancy in your account:</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px;">
          <tr><td><strong>Issue</strong></td><td>${d.type.replace(/_/g, ' ')}</td></tr>
          <tr><td><strong>Internal Amount</strong></td><td>$${(d.internal_amount || 0).toFixed(2)}</td></tr>
          <tr><td><strong>External Amount</strong></td><td>$${(d.external_amount || 0).toFixed(2)}</td></tr>
          <tr><td><strong>Difference</strong></td><td style="color:#dc2626;font-weight:bold">$${d.delta.toFixed(2)}</td></tr>
          <tr><td><strong>Details</strong></td><td>${d.description}</td></tr>
        </table>
        <p>Please review this discrepancy and contact our finance team if you have questions.</p>
        <p>— GamerGain Finance Team</p>
      `,
      from_name: 'GamerGain Finance',
    });
    toast.success(`Email sent to ${d.user_email}`);
    setEmailing(false);
  };

  return (
    <div className={`border-2 rounded-xl p-3 text-xs space-y-2 ${d.resolved ? 'border-gray-100 opacity-60' : 'border-red-100'}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
          {d.user_email && <span className="text-gray-500 font-mono">{d.user_email}</span>}
          {d.resolved && <Badge className="bg-green-100 text-green-700 text-xs">Resolved</Badge>}
        </div>
        <span className="font-black text-red-600 text-sm">${(d.delta || 0).toFixed(2)}</span>
      </div>
      <p className="text-gray-600">{d.description}</p>
      <div className="flex items-center gap-3 text-gray-500 flex-wrap">
        <span>Internal: <strong>${(d.internal_amount || 0).toFixed(2)}</strong></span>
        <span>→</span>
        <span>External: <strong>${(d.external_amount || 0).toFixed(2)}</strong></span>
        {d.external_tx_id && <span className="font-mono text-gray-400">TxID: {d.external_tx_id.slice(0, 16)}…</span>}
      </div>
      {!d.resolved && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 gap-1" onClick={markResolved} disabled={resolving}>
            {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Resolve
          </Button>
          {d.user_email && (
            <Button size="sm" variant="outline" className="h-6 text-xs border-blue-300 text-blue-600 hover:bg-blue-50 gap-1" onClick={sendPartnerEmail} disabled={emailing}>
              {emailing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Email Partner
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  const [resolvedSet, setResolvedSet] = useState(new Set());
  const hasIssues = (report.discrepancy_count || 0) > 0;

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${hasIssues ? 'border-red-200' : 'border-green-200'}`}>
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${hasIssues ? 'bg-red-100' : 'bg-green-100'}`}>
            {hasIssues ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {report.report_period_start} → {report.report_period_end}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500">
                Internal: <strong>${(report.total_internal_payouts || 0).toFixed(2)}</strong>
              </span>
              {report.total_stripe_payouts > 0 && (
                <span className="text-xs text-gray-500">Stripe: <strong>${report.total_stripe_payouts.toFixed(2)}</strong></span>
              )}
              {hasIssues && (
                <Badge className="bg-red-100 text-red-700 text-xs">{report.discrepancy_count} issues · ${(report.total_discrepancy_amount || 0).toFixed(2)}</Badge>
              )}
              {report.email_report_sent && <Badge className="bg-blue-100 text-blue-700 text-xs">📧 Emailed</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={report.status === 'completed' ? 'bg-green-100 text-green-700 text-xs' : 'bg-yellow-100 text-yellow-700 text-xs'}>
            {report.status}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-4">
          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            {[
              { label: 'Internal Payouts', value: `$${(report.total_internal_payouts || 0).toFixed(2)}`, color: 'text-gray-800' },
              { label: 'Stripe Total', value: `$${(report.total_stripe_payouts || 0).toFixed(2)}`, color: 'text-purple-700' },
              { label: 'PayPal Total', value: `$${(report.total_paypal_payouts || 0).toFixed(2)}`, color: 'text-blue-700' },
              { label: 'PPC Earnings', value: `$${(report.total_ppc_earnings || 0).toFixed(2)}`, color: 'text-green-700' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <p className={`text-base font-black ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Discrepancies */}
          {(report.discrepancies || []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Flagged Discrepancies
              </p>
              {report.discrepancies.map((d, i) => (
                <DiscrepancyRow
                  key={i}
                  d={resolvedSet.has(i) ? { ...d, resolved: true } : d}
                  index={i}
                  reportId={report.id}
                  onResolved={(idx) => setResolvedSet(prev => new Set([...prev, idx]))}
                />
              ))}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-xs text-green-700">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
              No discrepancies detected for this period.
            </div>
          )}

          {/* HTML report viewer */}
          {report.summary_html && (
            <details className="text-xs">
              <summary className="cursor-pointer text-blue-600 hover:underline flex items-center gap-1">
                <Eye className="w-3 h-3" /> View full HTML report
              </summary>
              <div
                className="mt-2 p-3 bg-white border border-gray-200 rounded-lg overflow-auto max-h-64"
                dangerouslySetInnerHTML={{ __html: report.summary_html }}
              />
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReconciliationPanel() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [daysBack, setDaysBack] = useState(30);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reconciliation-reports'],
    queryFn: () => base44.entities.ReconciliationReport.list('-created_date', 20),
    refetchInterval: running ? 3000 : false,
  });

  const handleRun = async () => {
    setRunning(true);
    toast.info('Running reconciliation engine…');
    try {
      const res = await base44.functions.invoke('reconciliationEngine', {
        days_back: daysBack,
        send_email: sendEmail,
        partner_email: partnerEmail || null,
      });
      const d = res.data;
      if (d.discrepancy_count > 0) {
        toast.warning(`⚠️ Found ${d.discrepancy_count} discrepancies totaling $${d.total_discrepancy_amount?.toFixed(2)}`);
      } else {
        toast.success('✅ Reconciliation complete — no discrepancies found!');
      }
      queryClient.invalidateQueries(['reconciliation-reports']);
    } catch (err) {
      toast.error('Reconciliation failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRunning(false);
    }
  };

  const latestReport = reports[0];
  const totalOpenDiscrepancies = reports
    .filter(r => r.status === 'completed')
    .reduce((s, r) => s + (r.discrepancy_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" /> Automated Reconciliation Engine
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cross-references Stripe/PayPal payouts with internal PPC records. Flags discrepancies and emails partners.
          </p>
        </div>
        {totalOpenDiscrepancies > 0 && (
          <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
            {totalOpenDiscrepancies} open discrepancies
          </Badge>
        )}
      </div>

      {/* Run controls */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-500" /> Run Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Period (days back)</label>
              <Input
                type="number"
                value={daysBack}
                onChange={e => setDaysBack(Number(e.target.value))}
                min={1}
                max={365}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Partner Email (optional)</label>
              <Input
                type="email"
                placeholder="partner@company.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                  className="mr-1.5"
                />
                Send email report
              </label>
              <Button
                onClick={handleRun}
                disabled={running}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                {running
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                  : <><RefreshCw className="w-4 h-4" /> Run Now</>
                }
              </Button>
            </div>
          </div>

          {running && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Fetching Stripe, PayPal & internal records…</span>
              </div>
              <Progress value={undefined} className="h-1.5 animate-pulse" />
            </div>
          )}

          {/* Quick stats from last run */}
          {latestReport && latestReport.status === 'completed' && (
            <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { icon: DollarSign, label: 'Internal', value: `$${(latestReport.total_internal_payouts || 0).toFixed(0)}`, color: 'text-gray-700' },
                { icon: BarChart2, label: 'Stripe', value: `$${(latestReport.total_stripe_payouts || 0).toFixed(0)}`, color: 'text-purple-600' },
                { icon: DollarSign, label: 'PayPal', value: `$${(latestReport.total_paypal_payouts || 0).toFixed(0)}`, color: 'text-blue-600' },
                { icon: AlertTriangle, label: 'Issues', value: latestReport.discrepancy_count || 0, color: latestReport.discrepancy_count > 0 ? 'text-red-600' : 'text-green-600' },
              ].map(s => (
                <div key={s.label}>
                  <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
              <div className="col-span-full text-xs text-gray-400 text-left">
                Last run: {latestReport.created_date ? formatDistanceToNow(new Date(latestReport.created_date), { addSuffix: true }) : '—'} by {latestReport.run_by}
                {latestReport.email_report_sent && ' · Email sent ✓'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report history */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" /> Report History ({reports.length})
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
        ) : reports.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2">
            <RefreshCw className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No reconciliation reports yet. Run your first one above.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}