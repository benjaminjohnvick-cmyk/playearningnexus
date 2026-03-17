import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Table, Users, DollarSign, TrendingUp, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';

const DATE_PRESETS = [
  { label: 'Last 7 days', fn: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Last 30 days', fn: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'This month', fn: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'All time', fn: () => ({ from: new Date('2020-01-01'), to: new Date() }) },
];

const EXPORT_TYPES = [
  { id: 'referrals', label: 'Referral Performance', icon: TrendingUp, color: 'text-blue-600', desc: 'Referrer, referred user, status, commission earned' },
  { id: 'payouts', label: 'Commission Payouts', icon: DollarSign, color: 'text-green-600', desc: 'Payout amounts, methods, status, dates' },
  { id: 'users', label: 'User Activity', icon: Users, color: 'text-purple-600', desc: 'User list, earnings, referral counts, join dates' },
  { id: 'links', label: 'Referral Links', icon: TrendingUp, color: 'text-orange-600', desc: 'Click counts, conversions, conversion rates by link' },
];

// ── CSV helpers ──────────────────────────────────────────────────────────────
const toCSV = (rows, headers) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))];
  return lines.join('\n');
};

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const downloadPDF = (title, headers, rows, filename) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 26);

  let y = 34;
  const colW = Math.min(40, (doc.internal.pageSize.width - 28) / headers.length);

  // Header row
  doc.setFillColor(37, 99, 235);
  doc.setTextColor(255, 255, 255);
  doc.rect(14, y, headers.length * colW, 8, 'F');
  headers.forEach((h, i) => doc.text(String(h).slice(0, 14), 16 + i * colW, y + 5.5));
  y += 10;

  doc.setTextColor(30, 30, 30);
  rows.forEach((row, ri) => {
    if (y > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20; }
    if (ri % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y, headers.length * colW, 7, 'F'); }
    headers.forEach((h, i) => {
      const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).slice(0, 18);
      doc.text(val, 16 + i * colW, y + 5);
    });
    y += 7;
  });

  doc.save(filename);
};

export default function DataExportCenter() {
  const [selectedTypes, setSelectedTypes] = useState(['referrals']);
  const [datePreset, setDatePreset] = useState('Last 30 days');
  const [format_, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState(DATE_PRESETS[1].fn());

  const { data: referrals = [] } = useQuery({ queryKey: ['export-referrals'], queryFn: () => base44.entities.Referral.list('-created_date', 1000) });
  const { data: payouts = [] } = useQuery({ queryKey: ['export-payouts'], queryFn: () => base44.entities.Payout.list('-created_date', 1000) });
  const { data: allUsers = [] } = useQuery({ queryKey: ['export-users'], queryFn: () => base44.entities.User.list('-created_date', 1000) });
  const { data: links = [] } = useQuery({ queryKey: ['export-links'], queryFn: () => base44.entities.CustomReferralLink.list('-created_date', 1000) });

  const applyPreset = (label) => {
    setDatePreset(label);
    const preset = DATE_PRESETS.find(p => p.label === label);
    if (preset) setDateRange(preset.fn());
  };

  const inRange = (dateStr) => {
    const d = new Date(dateStr);
    return d >= dateRange.from && d <= dateRange.to;
  };

  const toggleType = (id) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const buildReferralRows = () => referrals.filter(r => inRange(r.created_date)).map(r => ({
    'Referrer ID': r.referrer_user_id?.slice(0, 8) || '',
    'Referred User': r.referred_user_id?.slice(0, 8) || '',
    'Status': r.status || '',
    'Commission ($)': (r.commission_earned || 0).toFixed(2),
    'Commission Rate (%)': r.commission_rate || '',
    'Date': format(new Date(r.created_date), 'yyyy-MM-dd'),
  }));

  const buildPayoutRows = () => payouts.filter(p => inRange(p.created_date)).map(p => ({
    'User ID': p.user_id?.slice(0, 8) || '',
    'Recipient Email': p.recipient_email || '',
    'Amount ($)': (p.amount || 0).toFixed(2),
    'Method': p.method || '',
    'Type': p.payout_type || '',
    'Status': p.status || '',
    'Date': format(new Date(p.created_date), 'yyyy-MM-dd'),
    'Description': p.description || '',
  }));

  const buildUserRows = () => allUsers.filter(u => inRange(u.created_date)).map(u => ({
    'User ID': u.id?.slice(0, 8) || '',
    'Name': u.full_name || '',
    'Email': u.email || '',
    'Total Earnings ($)': (u.total_earnings || 0).toFixed(2),
    'Pending Earnings ($)': (u.pending_earnings || 0).toFixed(2),
    'Role': u.role || 'user',
    'Joined': format(new Date(u.created_date), 'yyyy-MM-dd'),
  }));

  const buildLinkRows = () => links.filter(l => inRange(l.created_date)).map(l => ({
    'User ID': l.user_id?.slice(0, 8) || '',
    'Campaign': l.campaign_name || '',
    'Code': l.link_code || '',
    'Source': l.referral_source || '',
    'Clicks': l.clicks || 0,
    'Conversions': l.conversions || 0,
    'Conv. Rate (%)': l.clicks > 0 ? ((l.conversions / l.clicks) * 100).toFixed(1) : '0',
    'Created': format(new Date(l.created_date), 'yyyy-MM-dd'),
  }));

  const BUILDERS = {
    referrals: { fn: buildReferralRows, title: 'Referral Performance Report', file: 'referral_performance' },
    payouts: { fn: buildPayoutRows, title: 'Commission Payouts Report', file: 'commission_payouts' },
    users: { fn: buildUserRows, title: 'User Activity Report', file: 'user_activity' },
    links: { fn: buildLinkRows, title: 'Referral Links Report', file: 'referral_links' },
  };

  const handleExport = async () => {
    if (selectedTypes.length === 0) return toast.error('Select at least one export type.');
    setExporting(true);
    try {
      for (const typeId of selectedTypes) {
        const { fn, title, file } = BUILDERS[typeId];
        const rows = fn();
        if (rows.length === 0) { toast.warning(`No data for "${typeId}" in selected date range.`); continue; }
        const headers = Object.keys(rows[0]);
        const dateStr = format(new Date(), 'yyyyMMdd');
        if (format_ === 'csv') {
          downloadCSV(toCSV(rows, headers), `${file}_${dateStr}.csv`);
        } else {
          downloadPDF(title, headers, rows, `${file}_${dateStr}.pdf`);
        }
        toast.success(`Exported ${rows.length} rows: ${title}`);
      }
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totalRows = {
    referrals: referrals.filter(r => inRange(r.created_date)).length,
    payouts: payouts.filter(p => inRange(p.created_date)).length,
    users: allUsers.filter(u => inRange(u.created_date)).length,
    links: links.filter(l => inRange(l.created_date)).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Data Export Center</h2>
        <p className="text-sm text-gray-500">Export referral performance, payouts, and user data to CSV or PDF for auditing</p>
      </div>

      {/* Date Range */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${datePreset === p.label ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" className="mt-1 text-sm" value={format(dateRange.from, 'yyyy-MM-dd')} onChange={e => setDateRange(p => ({ ...p, from: new Date(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" className="mt-1 text-sm" value={format(dateRange.to, 'yyyy-MM-dd')} onChange={e => setDateRange(p => ({ ...p, to: new Date(e.target.value) }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Types */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Select Data to Export</CardTitle>
          <CardDescription className="text-xs">You can select multiple datasets — each exports as a separate file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {EXPORT_TYPES.map(type => {
              const Icon = type.icon;
              const active = selectedTypes.includes(type.id);
              const count = totalRows[type.id] || 0;
              return (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : type.color}`} />
                      <span className={`text-sm font-semibold ${active ? 'text-blue-800' : 'text-gray-800'}`}>{type.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{count} rows</Badge>
                      {active && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{type.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Format & Export */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Format:</Label>
              <div className="flex gap-2">
                {['csv', 'pdf'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold uppercase transition-all ${format_ === f ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:border-blue-300'}`}
                  >
                    {f === 'csv' ? '📊 CSV' : '📄 PDF'}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={exporting || selectedTypes.length === 0}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 gap-2 ml-auto"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting...' : `Export ${selectedTypes.length} Dataset${selectedTypes.length !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {selectedTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTypes.map(id => {
                const t = EXPORT_TYPES.find(x => x.id === id);
                return <Badge key={id} className="bg-blue-100 text-blue-800 text-xs">{t?.label} ({totalRows[id]} rows)</Badge>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}