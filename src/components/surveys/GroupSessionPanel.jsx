import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, Send, Flag, UserPlus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import ChatPrefsBar from './ChatPrefsBar';

const CHEERS = ['Keep going! 🔥', "You've got this 💪", 'Almost there!', 'Nice pace! 👏', 'One more 👍', "Let's finish strong 🚀"];
const SAFETY = 'Keep it friendly and on-platform. Never send money or share contact info. Report anything off.';

/**
 * GroupSessionPanel — "earn together" in a group YOU size. Community first: pick a size, cheer each other on
 * (answer-walled + scam-guarded chat). After a group session you can mutually opt into a 1:1 with a member.
 * Everything opt-in and in-app; chat is retained for safety. No contact-info exchange, no meetups.
 */
export default function GroupSessionPanel() {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [size, setSize] = useState(4);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async (sid) => {
    const id = sid || sessionId;
    if (!id) return;
    try {
      const st = await base44.functions.invoke('groupStatus', { session_id: id });
      setStatus(st.data || null);
      const m = await base44.functions.invoke('groupMessages', { session_id: id, limit: 50 });
      setMessages(m.data?.messages || []);
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => {
    if (!joined) return;
    pollRef.current = setInterval(() => load(), 15000);
    return () => clearInterval(pollRef.current);
  }, [joined, load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('groupCreate', { size });
      if (res.data?.session_id) { setSessionId(res.data.session_id); setJoined(true); await load(res.data.session_id); }
    } catch { toast.error('Could not create group.'); } finally { setBusy(false); }
  };
  const quickJoin = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('groupJoin', { size });
      if (res.data?.session_id) { setSessionId(res.data.session_id); setJoined(true); await load(res.data.session_id); }
    } catch { toast.error('Could not join a group.'); } finally { setBusy(false); }
  };

  const send = async (kind, body) => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('groupSendMessage', { session_id: sessionId, kind, text: body });
      if (res.data?.blocked) toast.error(res.data.message || 'Message blocked.');
      else { setText(''); await load(); }
    } catch { toast.error('Could not send.'); } finally { setBusy(false); }
  };

  const pair1on1 = async (uid) => {
    try {
      const res = await base44.functions.invoke('groupStartOneOnOne', { session_id: sessionId, target_user_id: uid });
      if (res.data?.status === 'active') toast.success("You're now 1:1 buddies!");
      else if (res.data?.status === 'pending') toast.message('Sent — waiting for them to opt in too.');
      else toast.error(res.data?.error || 'Could not pair.');
    } catch { /* ignore */ }
  };

  const leave = async () => {
    if (sessionId) { try { await base44.functions.invoke('groupLeave', { session_id: sessionId, reason: '' }); } catch { /* ignore */ } }
    setJoined(false); setSessionId(null); setStatus(null); setMessages([]);
    toast.message('Left the group.');
  };

  const report = async () => {
    if (!sessionId) { setJoined(false); return; }
    try {
      const r = await base44.functions.invoke('reportChat', { kind: 'group', id: sessionId, reason: 'Inappropriate behavior' });
      toast.success(r.data?.message || 'Reported — the chat has ended and our team will review it.');
    } catch { toast.error('Could not submit report.'); }
    setJoined(false); setSessionId(null); setStatus(null); setMessages([]);
  };

  if (!joined) {
    return (
      <Card className="border-2 border-sky-100"><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-sky-600" /><h3 className="font-bold">Earn together in a group</h3></div>
        <p className="text-xs text-slate-500 mb-3">Pick a group size for company and accountability. Community first — you can pair off 1:1 later if you both want to.</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Group size</span>
          {[2, 4, 6, 12].map((n) => (
            <button key={n} onClick={() => setSize(n)} className={`text-xs px-2 py-1 rounded border ${size === n ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 text-slate-600'}`}>{n}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={quickJoin}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find a group'}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={create}>Start one (size {size})</Button>
        </div>
      </CardContent></Card>
    );
  }

  return (
    <Card className="border-2 border-sky-100"><CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Users className="w-5 h-5 text-sky-600" /><h3 className="font-bold">Your group {status?.status === 'open' ? '(filling…)' : ''}</h3></div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={leave}>leave</button>
          <button className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-0.5" onClick={report} title="Report inappropriate behavior — ends the chat and sends it to our team"><Flag className="w-3 h-3" /> Report</button>
        </div>
      </div>

      <ChatPrefsBar onChange={() => load()} />

      {/* Members + progress */}
      <div className="space-y-1.5 mb-3">
        {(status?.members || []).map((m) => {
          const pct = m.goal_usd ? Math.min(100, Math.round((m.earned_today / m.goal_usd) * 100)) : 0;
          return (
            <div key={m.user_id} className="flex items-center gap-2">
              <span className="text-xs w-16 truncate">{m.display_name}</span>
              <div className="flex-1 bg-slate-200 rounded-full h-2"><div className="bg-sky-500 h-2 rounded-full" style={{ width: `${pct}%` }} /></div>
              {!m.is_me && <button onClick={() => pair1on1(m.user_id)} title="Pair 1:1 (both must opt in)" className="text-sky-600"><UserPlus className="w-3.5 h-3.5" /></button>}
            </div>
          );
        })}
      </div>

      {/* Cheers */}
      <div className="flex flex-wrap gap-1 mb-2">
        {CHEERS.map((c) => <button key={c} disabled={busy} onClick={() => send('canned', c)} className="text-xs px-2 py-1 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-100">{c}</button>)}
      </div>

      {/* Messages */}
      <div className="max-h-32 overflow-y-auto space-y-1 mb-2 bg-slate-50 rounded p-2">
        {messages.length === 0 ? <div className="text-xs text-slate-400">Say hi to your group 👋</div> :
          messages.map((m) => (
            <div key={m.id} className={`text-xs ${m.from_me ? 'text-right' : 'text-left'}`}>
              {!m.from_me && <span className="text-[10px] text-slate-400 mr-1">{m.from_name}</span>}
              <span className={`inline-block px-2 py-1 rounded-lg ${m.from_me ? 'bg-sky-500 text-white' : 'bg-white border'}`}>{m.text}</span>
            </div>
          ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Encourage your group… (no answers, no contact info)"
          className="flex-1 border rounded-md px-2 py-1.5 text-sm" maxLength={280} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) send('text', text.trim()); }} />
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => send('text', text.trim())}><Send className="w-4 h-4" /></Button>
      </div>
      <div className="text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {SAFETY}</div>
    </CardContent></Card>
  );
}
