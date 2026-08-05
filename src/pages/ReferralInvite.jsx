import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Send, UserPlus, Users, Mail, Share2, CheckCircle2, Copy, Sparkles, ExternalLink } from 'lucide-react';

// Platforms for the AI copy generator. `prefill` = the Open button pre-fills the post; otherwise the text is
// on the clipboard and Open just takes them there to paste (Facebook/Instagram/TikTok/LinkedIn forbid prefill).
const AI_PLATFORMS = [
  { key: 'facebook', label: 'Facebook' }, { key: 'instagram', label: 'Instagram' }, { key: 'x', label: 'X' },
  { key: 'tiktok', label: 'TikTok' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'telegram', label: 'Telegram' },
  { key: 'reddit', label: 'Reddit' }, { key: 'linkedin', label: 'LinkedIn' }, { key: 'email', label: 'Email' }, { key: 'sms', label: 'Text' },
];
function openUrlFor(platform, text, link) {
  const t = encodeURIComponent(text || ''); const u = encodeURIComponent(link || '');
  switch (platform) {
    case 'x': return `https://twitter.com/intent/tweet?text=${t}`;
    case 'whatsapp': return `https://wa.me/?text=${t}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'reddit': return `https://www.reddit.com/submit?title=${encodeURIComponent('Check out GamerGain')}&text=${t}`;
    case 'email': return `mailto:?subject=${encodeURIComponent('Thought you’d like this')}&body=${t}`;
    case 'sms': return `sms:?&body=${t}`;
    case 'instagram': return 'https://www.instagram.com/';
    case 'tiktok': return 'https://www.tiktok.com/';
    case 'linkedin': return 'https://www.linkedin.com/feed/';
    default: return 'https://www.facebook.com/';
  }
}

// ReferralInvite — COMPLIANT multi-channel "invite everyone" hub. Contacts are read ON-DEVICE and every
// message is sent from the USER'S OWN apps: their Messages app (SMS), their email client (mailto), or the
// native Share Sheet (social). The server NEVER sends and NEVER stores contacts — it only returns the
// referral link/template and records a data-minimized count. This is the line that keeps it clear of
// TCPA/CAN-SPAM, the LinkedIn-style contact-harvesting suits, and the social platforms' anti-blast ToS.

function personalize(tpl, name, link) {
  return String(tpl || '').replaceAll('{{name}}', name || 'there').replaceAll('{{link}}', link || '');
}
function openSms(number, body) {
  const num = String(number || '').replace(/[^\d+]/g, '');
  const b = encodeURIComponent(body || '');
  const url = /(iPad|iPhone|iPod)/.test(navigator.userAgent) ? `sms:${num}&body=${b}` : `sms:${num}?body=${b}`;
  window.open(url, '_self');
}
function openMail(emails, subject, body) {
  const bcc = encodeURIComponent(emails.join(','));       // BCC keeps recipients private from each other
  const s = encodeURIComponent(subject || '');
  const b = encodeURIComponent(body || '');
  window.open(`mailto:?bcc=${bcc}&subject=${s}&body=${b}`, '_self');
}

export default function ReferralInvite() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [template, setTemplate] = useState('');
  const [contacts, setContacts] = useState([]);      // {name, number, email, selSms, selEmail}
  const [importing, setImporting] = useState(false);
  const [openedCount, setOpenedCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualVal, setManualVal] = useState('');
  const [aiBusy, setAiBusy] = useState('');
  const [ai, setAi] = useState(null);            // { platform, label, text }
  const [aiCopied, setAiCopied] = useState(false);

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

  const importContacts = async () => {
    setImporting(true);
    try {
      const mod = await import('@capacitor-community/contacts');
      const Contacts = mod.Contacts;
      const perm = await Contacts.requestPermissions();
      if (perm?.contacts !== 'granted') { setResult({ error: 'Contact permission is needed. You can also add people manually below.' }); return; }
      const { contacts: list } = await Contacts.getContacts({ projection: { name: true, phones: true, emails: true } });
      const mapped = (list || []).map((c) => ({
        name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' ') || 'Friend',
        number: c.phones?.[0]?.number || '',
        email: c.emails?.[0]?.address || '',
      })).filter((c) => c.number || c.email).map((c) => ({ ...c, selSms: false, selEmail: false }));
      setContacts(mapped);
      if (!mapped.length) setResult({ error: 'No contacts with a phone or email were found. Add people manually below.' });
    } catch {
      setResult({ error: "Couldn't open your contacts on this device — add people manually below (works on the phone app)." });
    } finally { setImporting(false); }
  };

  const addManual = () => {
    const v = manualVal.trim();
    if (!v) return;
    const isEmail = v.includes('@');
    setContacts((c) => [...c, { name: manualName.trim() || 'Friend', number: isEmail ? '' : v, email: isEmail ? v : '', selSms: !isEmail, selEmail: isEmail }]);
    setManualName(''); setManualVal('');
  };

  const link = cfg?.referral_link || '';
  const remaining = Math.max(0, (cfg?.remaining ?? 0) - openedCount);
  const smsSel = contacts.filter((c) => c.selSms && c.number);
  const emailSel = contacts.filter((c) => c.selEmail && c.email);
  const toggle = (i, field) => setContacts((c) => c.map((x, j) => j === i ? { ...x, [field]: !x[field] } : x));

  const textOne = (c) => {
    if (remaining <= 0) { setResult({ error: "You've reached today's invite limit — try again tomorrow." }); return; }
    openSms(c.number, personalize(template, c.name, link));
    setOpenedCount((n) => n + 1);
  };
  const emailAll = () => {
    if (!emailSel.length) return;
    if (remaining < emailSel.length) { setResult({ error: `Only ${remaining} invites left today.` }); return; }
    openMail(emailSel.map((c) => c.email), 'Thought you’d like this', personalize(template, 'there', link));
    setOpenedCount((n) => n + emailSel.length);
  };
  const shareSocial = async () => {
    const text = personalize(template, 'there', link);
    try {
      if (navigator.share) { await navigator.share({ title: 'GamerGain', text, url: link }); setOpenedCount((n) => n + 1); }
      else { await navigator.clipboard.writeText(`${text}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user cancelled share */ }
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ } };

  // ONE TAP: pick a platform → AI writes a post tuned to it → auto-copied to clipboard.
  const genCopy = async (p) => {
    setAiBusy(p); setAiCopied(false);
    try {
      const res = await base44.functions.invoke('referralAiCopy', { platform: p });
      const d = res.data;
      if (d?.text) {
        setAi(d);
        try { await navigator.clipboard.writeText(d.text); setAiCopied(true); } catch { setAiCopied(false); }
      } else { setResult({ error: d?.error || 'Could not generate a message.' }); }
    } catch (e) { setResult({ error: e?.message || 'Could not generate a message.' }); }
    finally { setAiBusy(''); }
  };

  const recordSent = async () => {
    if (openedCount <= 0 || !consent) return;
    setRecording(true);
    try {
      const res = await base44.functions.invoke('referralInviteRecord', {
        count: openedCount, channel: 'multi', template_customized: template !== (cfg?.template || ''),
        consent: { accepted: true },
      });
      setResult(res.data || null);
      if (res.data?.ok) { setCfg((p) => ({ ...p, sent_today: res.data.sent_today, remaining: res.data.remaining })); setOpenedCount(0); }
    } catch (e) { setResult({ error: e?.message || 'Something went wrong recording your invites.' }); }
    finally { setRecording(false); }
  };

  if (loading) return <div className="p-10 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (!cfg || cfg.enabled === false) return <div className="p-10 text-slate-600">Invites aren’t available right now.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" /> Invite your friends</h1>
        <p className="text-slate-600 text-sm mt-1">Invite people across text, email, and social in one place. Everything is sent from <strong>your own apps</strong> — we never see or store your contacts.</p>
      </div>

      {/* AI copy generator — one tap: pick a platform, we write + copy a post tuned to it. */}
      <Card className="mb-4 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="text-sm font-semibold text-violet-900 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Get a ready-to-post message</div>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Tap a platform — we write a post tuned to it and copy it to your clipboard. Then paste it wherever you like.</p>
          <div className="flex flex-wrap gap-2">
            {AI_PLATFORMS.map((p) => (
              <button key={p.key} onClick={() => genCopy(p.key)} disabled={!!aiBusy}
                className={`text-xs font-semibold rounded-full border px-3 py-1.5 transition ${ai?.platform === p.key ? 'border-violet-500 bg-violet-100 text-violet-800' : 'border-slate-300 bg-white text-slate-700 hover:border-violet-400'} disabled:opacity-50`}>
                {aiBusy === p.key ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : p.label}
              </button>
            ))}
          </div>
          {ai && (
            <div className="mt-3">
              <div className={`text-[11px] font-semibold mb-1 ${aiCopied ? 'text-emerald-700' : 'text-slate-600'}`}>
                {aiCopied ? `✓ Copied! Paste it into ${ai.label}.` : `Your ${ai.label} post:`}
              </div>
              <textarea readOnly value={ai.text} rows={4} className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" onFocus={(e) => e.target.select()} />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(ai.text); setAiCopied(true); } catch { /* noop */ } }}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy again
                </Button>
                <a href={openUrlFor(ai.platform, ai.text, link)} target="_blank" rel="noreferrer">
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open {ai.label}</Button>
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consent */}
      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I know these people personally, and I understand invites are sent from <strong>my own phone, email, and social apps</strong> — I choose who and tap send myself. Nothing is sent automatically.</span>
          </label>
        </CardContent>
      </Card>

      {/* Step 1 — prepare (import + template) */}
      <Card className="mb-4 border-slate-200">
        <CardContent className="p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">1 · Prepare your invites</div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={importContacts} disabled={!consent || importing} className="bg-amber-600 hover:bg-amber-700">
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading…</> : <><Users className="w-4 h-4 mr-2" /> Import my contacts</>}
            </Button>
            <span className="text-xs text-slate-500">or add someone (name + phone or email):</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Name" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-32" />
            <input value={manualVal} onChange={(e) => setManualVal(e.target.value)} placeholder="Phone or email" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-44" />
            <Button variant="outline" onClick={addManual} disabled={!consent}><UserPlus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-700 mb-1">Your message <span className="font-normal text-slate-500">— {'{{name}}'} = friend’s name, {'{{link}}'} = your link</span></div>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
            <div className="text-[11px] text-slate-400 mt-1 break-all">Your link: {link}
              <button onClick={copyLink} className="ml-2 text-amber-600 inline-flex items-center gap-0.5"><Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          {!consent && <p className="text-[11px] text-amber-700 mt-2">Check the box above first.</p>}
        </CardContent>
      </Card>

      {/* Step 2 — send by channel */}
      {contacts.length > 0 && (
        <Card className="mb-4 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-800">2 · Pick who, then send from your apps</div>
              <div className="text-xs text-slate-500">{remaining} invites left today</div>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center text-[11px] text-slate-400 mb-1">
              <span>Contact</span><span className="text-center">Text</span><span className="text-center">Email</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-800 truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{c.number || c.email}</div>
                  </div>
                  <input type="checkbox" checked={c.selSms} disabled={!c.number} onChange={() => toggle(i, 'selSms')} className="justify-self-center" />
                  <input type="checkbox" checked={c.selEmail} disabled={!c.email} onChange={() => toggle(i, 'selEmail')} className="justify-self-center" />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {smsSel.slice(0, 1).length > 0 && (
                <div className="text-[11px] text-slate-500 w-full">Texts open in your Messages app one at a time (personalized):</div>
              )}
              {smsSel.map((c, i) => (
                <Button key={i} size="sm" variant="outline" onClick={() => textOne(c)} disabled={!consent || remaining <= 0}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Text {c.name.split(' ')[0]}
                </Button>
              ))}
            </div>

            {emailSel.length > 0 && (
              <div className="mt-3">
                <Button onClick={emailAll} disabled={!consent || remaining < emailSel.length} className="bg-slate-700 hover:bg-slate-800">
                  <Mail className="w-4 h-4 mr-2" /> Email {emailSel.length} in your mail app
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Social share */}
      <Card className="mb-4 border-slate-200">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700"><Share2 className="w-4 h-4 inline mr-1 text-amber-600" /> Share your link to social — you pick where (Messenger, WhatsApp, Instagram, X…).</div>
          <Button onClick={shareSocial} disabled={!consent} variant="outline"><Share2 className="w-4 h-4 mr-1" /> Share</Button>
        </CardContent>
      </Card>

      {/* Record */}
      {openedCount > 0 && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> You’ve opened {openedCount} invite{openedCount > 1 ? 's' : ''}. Log them so they count toward your progress.</div>
            <Button onClick={recordSent} disabled={recording || !consent} className="bg-emerald-600 hover:bg-emerald-700">
              {recording ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> …</> : <>Log {openedCount}</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="text-sm text-emerald-700">{result.note}</p>}

      <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        <span>Your contacts never leave your phone — we only receive a count. Messages are sent from your own apps, so this stays a personal invite, not a mass blast. Only friends who actually join and complete a survey count as referrals. Referring is optional; you can unlock through surveys alone.</span>
      </div>
    </div>
  );
}
