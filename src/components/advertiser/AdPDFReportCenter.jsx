import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Mail, Download, Clock, Plus, Trash2, Loader2,
  Palette, Building2, TrendingUp, BarChart2, CheckCircle2, Sparkles
} from 'lucide-react';

const TAX_RATES = { None: 0, US: 0, GB: 0.20, EU: 0.21, CA: 0.13, AU: 0.10 };
const BRAND_COLORS = ['#eab308', '#a855f7', '#3b82f6', '#22c55e', '#ef4444', '#f97316'];
const FREQ_OPTIONS = ['weekly', 'monthly', 'quarterly'];
const REPORT_TYPES = [
  { id: 'performance', label: 'Performance Report', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'invoice', label: 'Tax Invoice', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'roi', label: 'ROI Analysis', icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'combined', label: 'Full Package', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

function InvoiceModal({ data, branding, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice</title><style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px 12px; border-bottom: 1px solid #eee; text-align: left; }
      .right { text-align: right; }
      .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
      .header-bar { padding: 20px; margin-bottom: 30px; border-radius: 8px; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div ref={printRef}>
          {/* Branded header */}
          <div className="p-8 rounded-t-2xl" style={{ backgroundColor: branding.color + '15', borderBottom: `4px solid ${branding.color}` }}>
            <div className="flex justify-between items-start">
              <div>
                {branding.logo && <img src={branding.logo} alt="logo" className="h-12 mb-3 object-contain" />}
                <h1 className="text-3xl font-black" style={{ color: branding.color }}>{data.reportType === 'invoice' ? 'TAX INVOICE' : 'PERFORMANCE REPORT'}</h1>
                <p className="text-gray-500 text-sm mt-0.5">#{data.invoiceNumber} · Generated {new Date().toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900 text-lg">{branding.companyName || 'GamerGain Ad Grid'}</p>
                <p className="text-gray-500 text-sm">{branding.tagline || 'advertising@gamergain.com'}</p>
                <span className="badge" style={{ backgroundColor: branding.color + '20', color: branding.color }}>{data.taxRegion} TAX</span>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Billing info */}
            <div className="grid grid-cols-2 gap-6 p-5 bg-gray-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Bill To</p>
                <p className="font-bold text-gray-900 text-lg">{data.companyName || 'Your Company'}</p>
                <p className="text-gray-500 text-sm">{data.recipientEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Period</p>
                <p className="font-bold text-gray-900">{data.dateFrom} → {data.dateTo}</p>
              </div>
            </div>

            {/* Campaign performance (for performance/combined reports) */}
            {(data.reportType === 'performance' || data.reportType === 'combined' || data.reportType === 'roi') && data.ads?.length > 0 && (
              <div>
                <h3 className="font-black text-gray-900 mb-3 text-sm uppercase tracking-wider">Campaign Performance</h3>
                <table>
                  <thead>
                    <tr style={{ backgroundColor: branding.color + '15' }}>
                      <th>Campaign</th>
                      <th className="right">Clicks</th>
                      <th className="right">Completions</th>
                      <th className="right">CTR</th>
                      <th className="right">Spent</th>
                      <th className="right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ads.map((ad, i) => {
                      const ctr = ad.total_clicks > 0 ? ((ad.surveys_completed / ad.total_clicks) * 100).toFixed(1) : '0';
                      const roi = ad.total_spent > 0 ? ((ad.surveys_completed * (ad.bid_amount || 0.4)) / ad.total_spent).toFixed(2) : '0';
                      return (
                        <tr key={i}>
                          <td><strong>{ad.brand_name}</strong> <span style={{ fontSize: 11, color: '#888' }}>{ad.grid_tier}</span></td>
                          <td className="right">{(ad.total_clicks || 0).toLocaleString()}</td>
                          <td className="right">{(ad.surveys_completed || 0).toLocaleString()}</td>
                          <td className="right">{ctr}%</td>
                          <td className="right">${(ad.total_spent || 0).toFixed(2)}</td>
                          <td className="right" style={{ color: parseFloat(roi) >= 1 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>{roi}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transactions (for invoice/combined) */}
            {(data.reportType === 'invoice' || data.reportType === 'combined') && (
              <div>
                <h3 className="font-black text-gray-900 mb-3 text-sm uppercase tracking-wider">Transactions</h3>
                <table>
                  <thead>
                    <tr style={{ backgroundColor: branding.color + '15' }}>
                      <th>Description</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charges.map((t, i) => (
                      <tr key={`c${i}`}>
                        <td>{t.description || `Ad spend — ${t.ad_brand || 'Campaign'}`}</td>
                        <td className="right" style={{ color: '#dc2626' }}>-${Math.abs(t.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {data.deposits.map((t, i) => (
                      <tr key={`d${i}`}>
                        <td>{t.description || 'Budget Top-Up'}</td>
                        <td className="right" style={{ color: '#16a34a' }}>+${Math.abs(t.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {data.charges.length === 0 && data.deposits.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999', padding: 20 }}>No transactions in this period</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ marginTop: 16, borderTop: '2px solid #eee', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                    <span>Total Ad Spend</span><span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${data.totalSpend.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                    <span>Total Top-Ups</span><span style={{ fontWeight: 'bold', color: '#16a34a' }}>+${data.totalDeposits.toFixed(2)}</span>
                  </div>
                  {data.taxRate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14, color: '#ea580c' }}>
                      <span>VAT/Tax ({(data.taxRate * 100).toFixed(0)}%)</span><span style={{ fontWeight: 'bold' }}>${data.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 8 }}>
                    <span>Total Billable</span><span style={{ color: branding.color }}>${data.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, fontSize: 11, color: '#888', textAlign: 'center' }}>
              This is a tax-compliant document generated by GamerGain Ad Grid. Invoice #{data.invoiceNumber}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 p-4 flex gap-2 bg-gray-50 rounded-b-2xl">
          <Button onClick={handlePrint} className="flex-1 gap-2" style={{ backgroundColor: branding.color, color: branding.textColor || '#000' }}>
            <Download className="w-4 h-4" /> Save as PDF (Print → Save)
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Close</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdPDFReportCenter({ userId, userEmail, ads }) {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxRegion, setTaxRegion] = useState('None');
  const [reportType, setReportType] = useState('combined');
  const [recipientEmail, setRecipientEmail] = useState(userEmail || '');
  const [companyName, setCompanyName] = useState('');
  const [branding, setBranding] = useState({ color: '#eab308', companyName: 'My Company', tagline: '', logo: '', textColor: '#000' });
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedFreq, setSchedFreq] = useState('monthly');
  const [schedEmail, setSchedEmail] = useState(userEmail || '');
  const [schedType, setSchedType] = useState('combined');
  const [logoUploading, setLogoUploading] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['adTransactions', userId],
    queryFn: () => base44.entities.AdTransaction.filter({ owner_user_id: userId }, '-created_date', 200),
    enabled: !!userId,
  });

  const buildReportData = () => {
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
    return {
      filtered, deposits, charges, totalDeposits, totalSpend, taxRate, taxAmount,
      grandTotal: totalSpend + taxAmount,
      invoiceNumber: `GG-${Date.now().toString().slice(-6)}`,
      companyName, recipientEmail, dateFrom, dateTo, taxRegion, reportType,
      ads,
    };
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setBranding(b => ({ ...b, logo: file_url }));
    setLogoUploading(false);
  };

  const handlePreview = () => setPreview(buildReportData());

  const handleEmail = async () => {
    if (!recipientEmail) return;
    setSending(true);
    const d = buildReportData();
    const body = `Hi,\n\nPlease find your GamerGain ${reportType === 'invoice' ? 'Tax Invoice' : 'Performance Report'} for the period ${dateFrom} to ${dateTo}.\n\n📊 SUMMARY\n• Total Ad Spend: $${d.totalSpend.toFixed(2)}\n• Total Top-Ups: $${d.totalDeposits.toFixed(2)}\n${d.taxRate > 0 ? `• VAT (${(d.taxRate * 100).toFixed(0)}%): $${d.taxAmount.toFixed(2)}\n` : ''}• Total Billable: $${d.grandTotal.toFixed(2)}\n• Transactions: ${d.filtered.length}\n• Invoice #: ${d.invoiceNumber}\n\n📈 CAMPAIGNS\n${ads.map(ad => `• ${ad.brand_name}: ${ad.surveys_completed || 0} completions, $${(ad.total_spent || 0).toFixed(2)} spent`).join('\n')}\n\nBest regards,\n${branding.companyName || 'GamerGain Ad Grid'}`;
    await base44.integrations.Core.SendEmail({ to: recipientEmail, subject: `GamerGain Report #${d.invoiceNumber} — ${dateFrom} to ${dateTo}`, body, from_name: branding.companyName || 'GamerGain Ad Grid' });
    setSending(false);
    alert(`Report emailed to ${recipientEmail}`);
  };

  const addSchedule = () => {
    if (!schedEmail) return;
    setSchedules(prev => [...prev, { id: Date.now(), freq: schedFreq, email: schedEmail, type: schedType, taxRegion, active: true }]);
    setShowSchedule(false);
  };

  const data = buildReportData();

  return (
    <div className="space-y-6">
      {preview && <InvoiceModal data={preview} branding={branding} onClose={() => setPreview(null)} />}

      {/* Report type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REPORT_TYPES.map(rt => (
          <button key={rt.id} onClick={() => setReportType(rt.id)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${reportType === rt.id ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-white hover:border-gray-500'}`}>
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Branding */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-purple-400" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Custom Branding</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Company Name</label>
            <input value={branding.companyName} onChange={e => setBranding(b => ({ ...b, companyName: e.target.value }))}
              placeholder="My Company Inc." className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Tagline / Subtitle</label>
            <input value={branding.tagline} onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))}
              placeholder="Your trusted ad partner" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Brand Color</label>
            <div className="flex gap-1.5 items-center">
              {BRAND_COLORS.map(c => (
                <button key={c} onClick={() => setBranding(b => ({ ...b, color: c }))}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${branding.color === c ? 'border-white scale-110' : 'border-transparent'}`} />
              ))}
              <input type="color" value={branding.color} onChange={e => setBranding(b => ({ ...b, color: e.target.value }))}
                className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-gray-600 p-0" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Company Logo</label>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition-all">
              {logoUploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Building2 className="w-4 h-4 text-gray-400" />}
              <span className="text-sm text-gray-400">{branding.logo ? 'Logo uploaded ✓' : 'Upload logo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
            </label>
          </div>
        </div>
        {/* Preview strip */}
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: branding.color + '15', borderLeft: `4px solid ${branding.color}` }}>
          {branding.logo && <img src={branding.logo} alt="logo" className="h-8 object-contain" />}
          <div>
            <p className="font-black text-white text-sm">{branding.companyName}</p>
            {branding.tagline && <p className="text-gray-400 text-xs">{branding.tagline}</p>}
          </div>
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: branding.color, color: '#000' }}>SAMPLE</span>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Bill To / Company</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Client Company Name" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Recipient Email</label>
            <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-red-400">-${data.totalSpend.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">Ad Spend</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">+${data.totalDeposits.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">Top-Ups</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-orange-400">${data.taxAmount.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">VAT/Tax</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">{data.filtered.length}</p>
          <p className="text-gray-500 text-xs">Transactions</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePreview} variant="outline" className="border-gray-600 text-gray-200 gap-2">
          <FileText className="w-4 h-4" /> Preview & Print PDF
        </Button>
        <Button onClick={handleEmail} disabled={sending || !recipientEmail}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Email Report'}
        </Button>
        <Button onClick={() => setShowSchedule(s => !s)} variant="outline" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2">
          <Clock className="w-4 h-4" /> Schedule Recurring
        </Button>
      </div>

      {/* Schedule form */}
      {showSchedule && (
        <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Recurring Report Schedule</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Frequency</label>
              <select value={schedFreq} onChange={e => setSchedFreq(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                {FREQ_OPTIONS.map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Report Type</label>
              <select value={schedType} onChange={e => setSchedType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                {REPORT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Send To</label>
              <input type="email" value={schedEmail} onChange={e => setSchedEmail(e.target.value)}
                placeholder="client@company.com" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <Button onClick={addSchedule} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 text-xs">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedules */}
      {schedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Recurring Schedules</p>
          {schedules.map(s => (
            <div key={s.id} className="bg-gray-900 border border-green-500/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <div>
                  <p className="text-white text-sm font-bold capitalize">{s.freq} {REPORT_TYPES.find(r => r.id === s.type)?.label}</p>
                  <p className="text-gray-500 text-xs">{s.email} · {s.taxRegion} tax</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">Active</Badge>
                <button onClick={() => setSchedules(p => p.filter(x => x.id !== s.id))} className="text-gray-600 hover:text-red-400 transition-colors">
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