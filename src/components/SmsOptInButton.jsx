import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';

// SmsOptInButton — verifiable SMS marketing consent capture (double opt-in). Drop onto a settings/profile
// page. Records real, auditable consent; actual SMS sending stays gated on a provider + the sms_marketing
// flag. Off by default per user (they must explicitly opt in).
const NAVY = '#16264f', INK = '#0a142e';

export default function SmsOptInButton() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(''); const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try { const r = await base44.functions.invoke('smsOptInStatus', {}); setData(r || null); if (r?.consent?.phone) setPhone(r.consent.phone); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const call = async (fn, payload, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await base44.functions.invoke(fn, payload); if (r?.error) setMsg({ type: 'error', text: r.error }); else { setMsg({ type: 'ok', text: r?.note || ok }); await load(); } }
    catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  };

  if (loading || !data?.enabled) return null;
  const st = data.consent?.status || 'none';

  return (
    <Card className="border" style={{ borderColor: '#e5e7eb' }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="w-5 h-5" style={{ color: NAVY }} />
          <span className="font-semibold text-gray-900">Text message updates</span>
          {st === 'confirmed' && <Badge className="bg-emerald-100 text-emerald-800">opted in</Badge>}
          {st === 'pending' && <Badge variant="outline" className="border-amber-300 text-amber-700">pending confirmation</Badge>}
          {(st === 'none' || st === 'revoked') && <Badge variant="outline" className="border-gray-300 text-gray-500">off</Badge>}
        </div>

        {st === 'confirmed' ? (
          <>
            <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />You're opted in at {data.consent.phone}.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => call('smsOptInRevoke', {}, 'Opted out.')}>Opt out (STOP)</Button>
          </>
        ) : (
          <>
            <div className="flex items-end gap-2 flex-wrap">
              <div><label className="text-xs text-gray-500">Mobile number</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="w-44 h-9" /></div>
            </div>
            <label className="flex items-start gap-2 text-[12px] text-gray-600">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
              <span>{data.disclosure}</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" disabled={busy || !agree || !phone} className="bg-[#16264f] hover:bg-[#0a142e]" onClick={() => call('smsOptInRequest', { phone, agree: true }, 'Recorded.')}>Opt in</Button>
              {st === 'pending' && <Button size="sm" variant="outline" disabled={busy} onClick={() => call('smsOptInConfirm', {}, 'Confirmed.')}>I confirm (double opt-in)</Button>}
            </div>
            <p className="text-[11px] text-gray-400 flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />Opt-in only, off unless you turn it on. Consent is not a condition of purchase; reply STOP anytime. No texts are sent until you confirm.</p>
          </>
        )}
        {msg && <div className={`text-xs rounded-lg p-2.5 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
      </CardContent>
    </Card>
  );
}
