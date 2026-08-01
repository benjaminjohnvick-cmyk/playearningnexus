import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, Send, Flag, UserPlus, Lock, Heart } from 'lucide-react';
import { toast } from 'sonner';
import ChatPrefsBar from './ChatPrefsBar';

const CHEERS = ['Keep going! 🔥', "You've got this 💪", 'Almost there!', 'Nice pace! 👏', 'One more 👍', "Let's finish strong 🚀"];

/**
 * BuddyPanel — "earn together". Pairs you with an accountability buddy: see each other's daily progress,
 * send encouragement (cheers + limited text — never survey answers), and unlock extended chat + an opt-in,
 * in-app connect once you've earned enough. Always optional — you can go solo or leave anytime. There is no
 * real-world meetup feature, by design.
 */
export default function BuddyPanel() {
  const [solo, setSolo] = useState(false);
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const st = await base44.functions.invoke('buddyStatus', {});
      setStatus(st.data || null);
      if (st.data?.pair_id) {
        const m = await base44.functions.invoke('buddyMessages', { pair_id: st.data.pair_id, limit: 40 });
        setMessages(m.data?.messages || []);
      }
    } catch { /* ignore */ }
  }, []);

  const match = useCallback(async () => {
    setLoading(true);
    try { await base44.functions.invoke('buddyMatch', {}); await load(); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [load]);

  useEffect(() => { if (!solo) match(); }, [solo, match]);
  useEffect(() => {
    if (solo) { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(load, 15000);
    return () => clearInterval(pollRef.current);
  }, [solo, load]);

  const send = async (kind, body) => {
    if (!status?.pair_id) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('buddySendMessage', { pair_id: status.pair_id, kind, text: body });
      if (res.data?.blocked) toast.error(res.data.message || 'Message blocked.');
      else { setText(''); await load(); }
    } catch { toast.error('Could not send.'); }
    finally { setBusy(false); }
  };

  const claimBonus = async () => {
    try { const r = await base44.functions.invoke('buddyBonusClaim', {}); if (r.data?.granted_usd > 0) toast.success(`Buddy bonus: +$${r.data.granted_usd.toFixed(2)} Site Cash!`); else if (r.data?.already) toast.message('Already claimed today.'); else toast.message('Earn a little first, then claim your buddy bonus.'); await load(); }
    catch { /* ignore */ }
  };

  const connect = async () => {
    try { const r = await base44.functions.invoke('buddyConnectRequest', { pair_id: status.pair_id }); if (r.data?.connected) toast.success("You're connected! 🤝"); else if (r.data?.waiting_on_buddy) toast.message('Sent — waiting for your buddy to opt in.'); else toast.error(r.data?.message || 'Not yet.'); await load(); }
    catch { /* ignore */ }
  };

  const leave = async () => {
    if (!status?.pair_id) { setSolo(true); return; }
    try { await base44.functions.invoke('buddyReport', { pair_id: status.pair_id, reason: '' }); } catch { /* ignore */ }
    setSolo(true); toast.message("You're earning solo now.");
  };

  const report = async () => {
    if (!status?.pair_id) return;
    try {
      const r = await base44.functions.invoke('reportChat', { kind: 'buddy', id: status.pair_id, reason: 'Inappropriate behavior' });
      toast.success(r.data?.message || 'Reported — the chat has ended and our team will review it.');
      setSolo(true);
    } catch { toast.error('Could not submit report.'); }
  };

  if (solo) {
    return (
      <Card className="border-dashed"><CardContent className="p-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">Earning solo.</span>
        <Button size="sm" variant="outline" onClick={() => setSolo(false)}><Users className="w-4 h-4 mr-1" /> Find a buddy</Button>
      </CardContent></Card>
    );
  }
  if (loading) return <div className="p-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Finding you a buddy…</div>;
  if (!status) return null;

  const pctMe = status.me?.goal_usd ? Math.min(100, Math.round((status.me.earned_today / status.me.goal_usd) * 100)) : 0;
  const pctBuddy = status.buddy?.goal_usd ? Math.min(100, Math.round((status.buddy.earned_today / status.buddy.goal_usd) * 100)) : 0;
  const waiting = status.status === 'waiting' || !status.has_buddy;

  return (
    <Card className="border-2 border-violet-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-violet-600" /><h3 className="font-bold">Earn together</h3></div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-slate-400 hover:text-slate-600" onClick={leave}>go solo</button>
            {status.has_buddy && <button className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-0.5" onClick={report} title="Report inappropriate behavior — ends the chat and sends it to our team"><Flag className="w-3 h-3" /> Report</button>}
          </div>
        </div>

        <ChatPrefsBar onChange={() => { match(); }} />
        {waiting ? (
          <div className="text-sm text-slate-500 py-3">Looking for a buddy who's earning now — keep going, and we'll pair you the moment someone's free. <button className="text-violet-600 ml-1" onClick={match}>refresh</button></div>
        ) : (
          <>
            {/* Both progress bars */}
            <div className="space-y-2 mb-3">
              <div>
                <div className="flex justify-between text-xs mb-0.5"><span>You</span><span className="text-slate-500">${status.me.earned_today?.toFixed(2)} / ${status.me.goal_usd?.toFixed(0)}</span></div>
                <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-violet-500 h-2 rounded-full" style={{ width: `${pctMe}%` }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-0.5"><span>{status.buddy?.display_name || 'Buddy'}</span><span className="text-slate-500">${status.buddy?.earned_today?.toFixed(2)} / ${status.buddy?.goal_usd?.toFixed(0)}</span></div>
                <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${pctBuddy}%` }} /></div>
              </div>
            </div>

            {/* Cheers */}
            <div className="flex flex-wrap gap-1 mb-2">
              {CHEERS.map((c) => <button key={c} disabled={busy} onClick={() => send('canned', c)} className="text-xs px-2 py-1 rounded-full bg-violet-50 hover:bg-violet-100 border border-violet-100">{c}</button>)}
            </div>

            {/* Messages */}
            <div className="max-h-32 overflow-y-auto space-y-1 mb-2 bg-slate-50 rounded p-2">
              {messages.length === 0 ? <div className="text-xs text-slate-400">Say hi and cheer each other on 👋</div> :
                messages.map((m) => (
                  <div key={m.id} className={`text-xs ${m.from_me ? 'text-right' : 'text-left'}`}>
                    <span className={`inline-block px-2 py-1 rounded-lg ${m.from_me ? 'bg-violet-500 text-white' : 'bg-white border'}`}>{m.text}</span>
                  </div>
                ))}
            </div>

            {/* Text (encouragement only) */}
            <div className="flex items-center gap-2 mb-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Encourage your buddy… (no survey answers)"
                className="flex-1 border rounded-md px-2 py-1.5 text-sm" maxLength={280} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) send('text', text.trim()); }} />
              <Button size="sm" disabled={busy || !text.trim()} onClick={() => send('text', text.trim())}><Send className="w-4 h-4" /></Button>
            </div>
            <div className="text-[10px] text-slate-400 mb-3">Chat is for encouragement only — sharing survey answers is blocked. {status.chat?.remaining != null && `${status.chat.remaining} messages left today.`}</div>

            {/* Buddy bonus + unlock/connect */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={claimBonus}><Heart className="w-4 h-4 mr-1" /> Claim buddy bonus</Button>
              {status.connect?.connected ? (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><UserPlus className="w-3 h-3" /> Connected</span>
              ) : status.unlock?.unlocked ? (
                <Button size="sm" variant="outline" onClick={connect}><UserPlus className="w-4 h-4 mr-1" /> Connect in-app</Button>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" /> ${status.unlock?.remaining_usd?.toFixed(2)} more earned unlocks extended chat + connect</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
