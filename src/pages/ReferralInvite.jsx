import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Send, UserPlus, Users, Info, CheckCircle2 } from 'lucide-react';

// ReferralInvite — the COMPLIANT contact-invite flow. Contacts are read ON-DEVICE (Capacitor Contacts
// plugin) and messages are sent from the USER'S OWN phone (native SMS). The server never sends and never
// receives contacts — we only fetch the referral link/template and record a data-minimized count.

function personalize(tpl, name, link) {
  return String(tpl || '')
    .replaceAll('{{name}}', name || 'there')
    .replaceAll('{{link}}', link || '');
}

// Open the user's native SMS composer for one recipient, pre-filled. The user reviews + taps send.
function openSms(number, body) {
  const num = String(number || '').replace(/[^\d+]/g, '');
  const b = encodeURIComponent(body || '');
  // iOS uses `&body=`, Android uses `?body=`; this form works acceptably on both via the default handler.
  const url = /(iPad|iPhone|iPod)/.test(navigator.userAgent) ? `sms:${num}&body=${b}` : `sms:${num}?body=${b}`;
  window.open(url, '_self');
}

export default function ReferralInvite() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [template, setTemplate] = useState('');
  const [contacts, setContacts] = useState([]);      // {name, number, selected}
  const [importing, setImporting] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [manualName, setManualName] = useState('');
  const [manualNum, setManualNum] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('referralInviteConfig', {});
        setCfg(res.data || null);
        setTemplate(res.data?.template || '');
      } catch { setCfg(null); }
      finally { setLoading(false); }
    })();
  }, []);

  // Read contacts on-device (Capacitor Contacts). Falls back to manual entry if the plugin isn't available.
  const importContacts = async () => {
    setImporting(true);
    try {
      const mod = await import('@capacitor-community/contacts');
      const Contacts = mod.Contacts;
      const perm = await Contacts.requestPermissions();
      if (perm?.contacts !== 'granted') { setResult({ error: 'Contact permission is needed to import your contacts. You can also add people manually below.' }); return; }
      const { contacts: list } = await Contacts.getContacts({ projection: { name: true, phones: true } });
      const mapped = (list || [])
        .map((c) => ({ name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' ') || 'Friend', number: c.phones?.[0]?.number || '' }))
        .filter((c) => c.number)
        .map((c) => ({ ...c, selected: false }));
      setContacts(mapped);
      if (!mapped.length) setResult({ error: 'No contacts with phone numbers were found. Add people manually below.' });
    } catch {
      setResult({ error: "Couldn't open your contacts on this device — add people manually below (this works on the phone app)." });
    } finally { setImporting(false); }
  };

  const addManual = () => {
    if (!manualNum.trim()) return;
    setContacts((c) => [...c, { name: manualName.trim() || 'Friend', number: manualNum.trim(), selected: true }]);
    setManualName(''); setManualNum('');
  };

  const toggle = (i) => setContacts((c) => c.map((x, j) => j === i ? { ...x, selected: !x.selected } : x));
  const selected = contacts.filter((c) => c.selected);
  const remaining = Math.max(0, (cfg?.remaining ?? 0) - sentCount);
  const link = cfg?.referral_link || '';

  const sendOne = (c) => {
    if (remaining <= 0) { setResult({ error: "You've reached today's invite limit — try again tomorrow." }); return; }
    openSms(c.number, personalize(template, c.name, link));
    setSentCount((n) => n + 1);
  };

  const recordSent = async () => {
    if (sentCount <= 0 || !consent) return;
    setRecording(true);
    try {
      const res = await base44.functions.invoke('referralInviteRecord', {
        count: sentCount, channel: 'sms', template_customized: template !== (cfg?.template || ''),
        consent: { accepted: true },
      });
      setResult(res.data || null);
      if (res.data?.ok) { setCfg((p) => ({ ...p, sent_today: res.data.sent_today, remaining: res.data.remaining })); setSentCount(0); }
    } catch (e) { setResult({ error: e?.message || 'Something went wrong recording your invites.' }); }
    finally { setRecording(false); }
  };

  if (loading) return <div className="p-10 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (!cfg || cfg.enabled === false) return <div className="p-10 text-slate-600">Contact invites aren’t available right now.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" /> Invite your friends</h1>
        <p className="text-slate-600 text-sm mt-1">Referring friends is the fastest way to unlock your advertiser benefits. Invites are sent from <strong>your own phone</strong> — we never see or store your contacts.</p>
      </div>

      {/* Consent */}
      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I know these contacts personally, and I understand the messages are sent from <strong>my own phone</strong> — I choose who to text and tap send myself. (You can skip anyone; nothing is sent automatically.)</span>
          </label>
        </CardContent>
      </Card>

      {/* Import / add */}
      <Card className="mb-4 border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={importContacts} disabled={!consent || importing} className="bg-amber-600 hover:bg-amber-700">
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading…</> : <><Users className="w-4 h-4 mr-2" /> Import my contacts</>}
            </Button>
            <span className="text-xs text-slate-500">or add someone manually:</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Name" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-32" />
            <input value={manualNum} onChange={(e) => setManualNum(e.target.value)} placeholder="Phone number" inputMode="tel" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-40" />
            <Button variant="outline" onClick={addManual} disabled={!consent}><UserPlus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
          {!consent && <p className="text-[11px] text-amber-700 mt-2">Check the box above first.</p>}
        </CardContent>
      </Card>

      {/* Template */}
      <Card className="mb-4 border-slate-200">
        <CardContent className="p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">Your message <span className="text-xs font-normal text-slate-500">— edit freely. {'{{name}}'} = friend’s name, {'{{link}}'} = your link.</span></div>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
          {selected[0] && (
            <div className="mt-2 text-[11px] text-slate-500">
              Preview for {selected[0].name}: <span className="text-slate-700">{personalize(template, selected[0].name, link)}</span>
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-1 break-all">Your link: {link}</div>
        </CardContent>
      </Card>

      {/* Contacts list */}
      {contacts.length > 0 && (
        <Card className="mb-4 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-800">Pick who to text ({selected.length} selected)</div>
              <div className="text-xs text-slate-500">{remaining} invites left today</div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <input type="checkbox" checked={c.selected} onChange={() => toggle(i)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{c.number}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => sendOne(c)} disabled={!consent || remaining <= 0}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Text
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record */}
      {sentCount > 0 && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> You’ve opened {sentCount} invite{sentCount > 1 ? 's' : ''}. Tap to log them so they count toward your progress.</div>
            <Button onClick={recordSent} disabled={recording || !consent} className="bg-emerald-600 hover:bg-emerald-700">
              {recording ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> …</> : <>Log {sentCount} sent</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="text-sm text-emerald-700">{result.note}</p>}

      <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        <span>Your contacts never leave your phone — we only receive a count. Only friends who actually join and complete a survey count as referrals. Referring is optional; you can unlock through surveys alone.</span>
      </div>
    </div>
  );
}
