import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertTriangle, Loader2, FileText, CheckCircle2 } from 'lucide-react';

// TaxCenter — backend-driven W-9 status + submission for payout recipients (developers/affiliates). Reads the
// authoritative taxProfileStatus (W-9 on file, YTD reportable vs the 1099 threshold, backup withholding) and,
// when no W-9 is on file, lets the partner submit one (submitTaxInfo) to receive full payouts. The raw TIN is
// sent directly to the endpoint and never rendered back — only the masked TIN is ever shown.
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const CLASSIFICATIONS = [
  ['individual', 'Individual / sole proprietor'],
  ['llc', 'LLC'],
  ['c_corp', 'C corporation'],
  ['s_corp', 'S corporation'],
  ['partnership', 'Partnership'],
];

export default function TaxCenter() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    legal_name: '', business_name: '', tax_classification: 'individual',
    tin_type: 'ssn', tin: '', address: '', city: '', state: '', zip: '', certification: false,
  });

  const load = async () => {
    try {
      const res = await base44.functions.invoke('taxProfileStatus', {});
      setStatus(res && !res.error ? res : null);
    } catch { setStatus(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.legal_name) { setMsg({ type: 'error', text: 'Legal name is required.' }); return; }
    if (String(form.tin).replace(/\D/g, '').length !== 9) { setMsg({ type: 'error', text: 'TIN must be 9 digits.' }); return; }
    if (!form.certification) { setMsg({ type: 'error', text: 'You must certify the information.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('submitTaxInfo', { ...form, certification: true });
      if (res?.error) setMsg({ type: 'error', text: res.error + (res.missing ? ` (${res.missing.join(', ')})` : '') });
      else { setMsg({ type: 'ok', text: 'W-9 received — your payouts will be sent in full.' }); setShowForm(false); setForm((f) => ({ ...f, tin: '' })); load(); }
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Could not submit.' });
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md"><CardContent className="p-6 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading tax status…
      </CardContent></Card>
    );
  }
  if (!status) return null;

  const onFile = status.w9_on_file;
  const alertKind = onFile ? 'ok' : (status.w9_required ? 'error' : status.w9_approaching ? 'warn' : 'info');
  const alertStyle = { ok: 'bg-green-50 border-green-200', error: 'bg-red-50 border-red-200', warn: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200' }[alertKind];

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-indigo-600" /> Tax Center (W-9 / 1099)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${alertStyle}`}>
          {onFile ? <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">{status.year} tax year</p>
              {onFile
                ? <Badge className="bg-green-100 text-green-700 border-0">W-9 on file</Badge>
                : <Badge className="bg-amber-100 text-amber-700 border-0">No W-9</Badge>}
            </div>
            <p className="text-xs text-gray-600 mt-1">{status.note}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">YTD reportable</p>
            <p className="text-lg font-bold text-gray-900">{money(status.ytd_reportable_usd)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Threshold</p>
            <p className="text-lg font-bold text-gray-900">{money(status.threshold_usd)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Withheld YTD</p>
            <p className="text-lg font-bold text-gray-900">{money(status.ytd_withheld_usd)}</p>
          </div>
        </div>

        {status.tin_masked && <p className="text-xs text-gray-500">TIN on file: {status.tin_masked}</p>}

        {!onFile && !showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">Submit W-9</Button>
        )}

        {!onFile && showForm && (
          <div className="space-y-3 border-t pt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Legal name *</Label><Input value={form.legal_name} onChange={set('legal_name')} placeholder="As on your tax return" /></div>
              <div><Label className="text-xs">Business name</Label><Input value={form.business_name} onChange={set('business_name')} placeholder="If different" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tax classification *</Label>
                <select value={form.tax_classification} onChange={set('tax_classification')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {CLASSIFICATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">TIN type *</Label>
                <select value={form.tin_type} onChange={set('tin_type')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="ssn">SSN</option><option value="ein">EIN</option>
                </select>
              </div>
            </div>
            <div><Label className="text-xs">TIN (9 digits) *</Label><Input value={form.tin} onChange={set('tin')} placeholder="•••••••••" inputMode="numeric" /></div>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2"><Label className="text-xs">Address</Label><Input value={form.address} onChange={set('address')} /></div>
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={set('city')} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">State</Label><Input value={form.state} onChange={set('state')} /></div>
                <div><Label className="text-xs">ZIP</Label><Input value={form.zip} onChange={set('zip')} /></div>
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={form.certification} onChange={(e) => setForm((f) => ({ ...f, certification: e.target.checked }))} className="mt-0.5" />
              Under penalties of perjury, I certify that the information above is correct and that I am a U.S. person.
            </label>
            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Certify & submit'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setMsg(null); }}>Cancel</Button>
            </div>
            <p className="text-[11px] text-gray-400">Your TIN is transmitted securely and stored only in masked form here. We don't provide tax advice — consult a tax professional.</p>
          </div>
        )}

        {msg && (
          <div className={`text-sm rounded-lg p-3 flex items-center gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {msg.type === 'ok' && <CheckCircle2 className="w-4 h-4" />}{msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
