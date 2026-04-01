import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Mail, Download, Calendar, DollarSign, TrendingUp, Loader2, Plus, Trash2, Clock } from 'lucide-react';

const TAX_RATES = { 'US': 0, 'GB': 0.20, 'EU': 0.21, 'CA': 0.13, 'AU': 0.10, 'None': 0 };

function buildInvoiceText(transactions, dateFrom, dateTo, taxRegion, companyName, recipientEmail) {
  const filtered = transactions.filter(t => {
    const d = new Date(t.created_date);
    return d >= new Date(dateFrom) && d <= new Date(dateTo);
  });
  const deposits = filtered.filter(t => t.type === 'deposit');
  const charges = filtered.filter(t => t.type === 'charge');
  const totalDeposits = deposits.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalSpend = charges.reduce((s, t) => s + Math.abs(t.amount), 0);
  const taxRate = TAX_RATES[taxRegion] || 0;
  const taxAmount = totalSpend * taxRate;
  const grandTotal = totalSpend + taxAmount;

  return {
    filtered, deposits, charges, totalDeposits, totalSpend, taxRate, taxAmount, grandTotal,
    invoiceNumber: `GG-${Date.now().toString().slice(-6)}`,
    companyName, recipientEmail, dateFrom, dateTo, taxRegion,
  };
}

function InvoicePreview({ data, onClose }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">TAX INVOICE</h1>
            <p className="text-gray-500 text-sm">Invoice #{data.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-gray-900">GamerGain Ad Grid</p>
            <p className="text-gray-500 text-xs">advertising@gamergain.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase">Bill To</p>
            <p className="font-bold">{data.companyName || 'Your Company'}</p>
            <p className="text-sm text-gray-500">{data.recipientEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Period</p>
            <p className="font-bold text-sm">{data.dateFrom} → {data.dateTo}</p>
            <p className="text-xs text-gray-500">Tax Region: {data.taxRegion}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-bold text-gray-700">Description</th>
              <th className="text-right py-2 font-bold text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.charges.map((t, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 text-gray-700">{t.description || `Ad spend — ${t.ad_brand || 'Campaign'}`}</td>
                <td className="py-2 text-right text-red-600">-${Math.abs(t.amount).toFixed(2)}</td>
              </tr>
            ))}
            {data.deposits.map((t, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 text-gray-700">{t.description || 'Budget Top-Up'}</td>
                <td className="py-2 text-right text-green-600">+${Math.abs(t.amount).toFixed(2)}</td>
              </tr>
            ))}
            {data.filtered.length === 0 && (
              <tr><td colSpan={2} className="py-4 text-center text-gray-400">No transactions in this period</td></tr>
            )}
          </tbody>
        </table>

        <div className="space-y-2 border-t-2 border-gray-200 pt-4">
          <div className="flex justify-between text-sm"><span>Total Ad Spend</span><span className="font-bold">-${data.totalSpend.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span>Total Top-Ups</span><span className="font-bold text-green-600">+${data.totalDeposits.toFixed(2)}</span></div>
          {data.taxRate > 0 && (
            <div className="flex justify-between text-sm text-orange-600"><span>VAT/Tax ({(data.taxRate * 100).toFixed(0)}%)</span><span className="font-bold">${data.taxAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-base font-black border-t border-gray-200 pt-2">
            <span>Total Billable</span><span>${data.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
          This document serves as a tax-compliant invoice for GamerGain advertising services.
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1">Close</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdBillingInvoice({ userId, userEmail }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxRegion, setTaxRegion] = useState('None');
  const [companyName, setCompanyName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(userEmail || '');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedFreq, setSchedFreq] = useState('monthly');
  const [schedEmail, setSchedEmail] = useState(userEmail || '');

  const { data: transactions = [] } = useQuery({
    queryKey: ['adTransactions', userId],
    queryFn: () => base44.entities.AdTransaction.filter({ owner_user_id: userId }, '-created_date', 200),
    enabled: !!userId,
  });

  const invoiceData = buildInvoiceText(transactions, dateFrom, dateTo, taxRegion, companyName, recipientEmail);

  const handlePreview = () => setPreview(invoiceData);

  const handleSendEmail = async () => {
    setSending(true);
    const body = `
Hi,

Please find attached your GamerGain Ad Spend Report for ${dateFrom} to ${dateTo}.

Summary:
• Total Ad Spend: $${invoiceData.totalSpend.toFixed(2)}
• Total Top-Ups: $${invoiceData.totalDeposits.toFixed(2)}
${invoiceData.taxRate > 0 ? `• VAT/Tax (${(invoiceData.taxRate * 100).toFixed(0)}%): $${invoiceData.taxAmount.toFixed(2)}` : ''}
• Total Billable: $${invoiceData.grandTotal.toFixed(2)}
• Transactions: ${invoiceData.filtered.length}
• Invoice #: ${invoiceData.invoiceNumber}

Tax Region: ${taxRegion}

Best regards,
GamerGain Ad Grid
    `;
    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: `GamerGain Invoice #${invoiceData.invoiceNumber} — ${dateFrom} to ${dateTo}`,
      body,
    });
    setSending(false);
    alert(`Invoice sent to ${recipientEmail}`);
  };

  const addSchedule = () => {
    if (!schedEmail) return;
    setSchedules(prev => [...prev, { id: Date.now(), freq: schedFreq, email: schedEmail, taxRegion, active: true }]);
    setShowScheduleForm(false);
  };

  return (
    <div className="space-y-5">
      {preview && <InvoicePreview data={preview} onClose={() => setPreview(null)} />}

      {/* Config */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Company / Billed To</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Your Company Name" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Recipient Email</label>
            <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
              placeholder="accountant@company.com" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Tax Region</label>
            <select value={taxRegion} onChange={e => setTaxRegion(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
              {Object.keys(TAX_RATES).map(r => <option key={r} value={r}>{r} ({(TAX_RATES[r] * 100).toFixed(0)}% VAT)</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-red-400">-${invoiceData.totalSpend.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-0.5">Ad Spend</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">+${invoiceData.totalDeposits.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-0.5">Top-Ups</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-orange-400">${invoiceData.taxAmount.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-0.5">VAT/Tax</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">{invoiceData.filtered.length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Transactions</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePreview} variant="outline" className="border-gray-600 text-gray-200 gap-2">
          <FileText className="w-4 h-4" /> Preview Invoice
        </Button>
        <Button onClick={handleSendEmail} disabled={sending || !recipientEmail}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Email Invoice'}
        </Button>
        <Button onClick={() => setShowScheduleForm(s => !s)} variant="outline" className="border-gray-600 text-gray-200 gap-2">
          <Clock className="w-4 h-4" /> Schedule Recurring
        </Button>
      </div>

      {/* Schedule form */}
      {showScheduleForm && (
        <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Set Up Recurring Invoice</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Frequency</label>
              <select value={schedFreq} onChange={e => setSchedFreq(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Send To</label>
              <input type="email" value={schedEmail} onChange={e => setSchedEmail(e.target.value)}
                placeholder="email@company.com" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <Button onClick={addSchedule} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1">
                <Plus className="w-4 h-4" /> Add Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active schedules */}
      {schedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Recurring Schedules</p>
          {schedules.map(s => (
            <div key={s.id} className="bg-gray-900 border border-green-500/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-green-400" />
                <div>
                  <p className="text-white text-sm font-bold capitalize">{s.freq} invoice</p>
                  <p className="text-gray-500 text-xs">{s.email} · {s.taxRegion} tax</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">Active</Badge>
                <button onClick={() => setSchedules(prev => prev.filter(x => x.id !== s.id))}
                  className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}