import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Sparkles, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';

// JoinAndConnect — the one-click "Join" experience. A single button opens a plain-language disclosure the
// member can read in full and OPT OUT of, then records consent (socialSignupConsent) and sends them to connect
// their accounts. Honest by design: we can't silently connect accounts — each platform is a one-tap
// authorization the member grants themselves — and every posted ad is #ad-labeled and the member taps Post.
const NAVY = '#16264f', GOLD = '#e8c766';
const DISCLOSURE_VERSION = 'social-amp-join-1';

export default function JoinAndConnect() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [optIn, setOptIn] = useState(true);       // default ON; the member can uncheck to opt out
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function confirm() {
    setBusy(true); setMsg(null);
    try {
      const r = await base44.functions.invoke('socialSignupConsent', {
        opt_in: optIn, accepted: true, disclosure_version: DISCLOSURE_VERSION, source: 'one_click_join',
      });
      if (r?.error) { setMsg({ type: 'error', text: r.error }); setBusy(false); return; }
      setOpen(false);
      if (r.opted_in) navigate('/SocialMediaSetup');
      else setMsg({ type: 'ok', text: r.note });
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2" style={{ color: NAVY }}>
          <Sparkles className="w-7 h-7" style={{ color: GOLD }} /> Join in one click
        </h1>
        <p className="text-muted-foreground">
          Get set up in a single click. You'll be opted in to earn rewards for sharing AI-made,
          clearly-labeled ads on the social accounts you choose to connect — and you can opt out right here.
        </p>
      </div>

      {msg && <div className={`text-sm rounded-md px-3 py-2 text-center ${msg.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}

      <div className="text-center">
        <Button size="lg" className="px-8 text-base" style={{ background: NAVY }} onClick={() => setOpen(true)}>
          <Sparkles className="w-5 h-5 mr-2" /> Join with one click
        </Button>
        <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> You'll see exactly what you're agreeing to — and can opt out — before anything happens.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Before you join — the specifics</DialogTitle></DialogHeader>
          <ScrollArea className="h-64 pr-3 text-sm text-slate-700 space-y-3">
            <div className="space-y-3">
              <p><b>What "one-click join" does.</b> It creates your membership and turns <b>on</b> social
                advertising rewards. You can turn it off right now by unchecking the box below, or anytime in
                Settings.</p>
              <p><b>You connect each account yourself.</b> We <b>cannot</b> and do not silently access or connect
                your social accounts. Each platform (Instagram, X, TikTok, Facebook, LinkedIn…) asks you to
                authorize it on <i>that platform's own screen</i> — one tap each. You choose which to connect.</p>
              <p><b>You always tap "Post."</b> When an ad is ready, it's queued to your composer; <b>you</b> hit
                Post. Nothing is ever posted for you automatically.</p>
              <p><b>Every ad is clearly labeled.</b> Posts carry a <b>#ad</b> sponsorship disclosure, as the FTC
                requires.</p>
              <p><b>Your reach counts as value.</b> Your follower counts on connected accounts are used to
                estimate how many people your posts reach; that reach counts toward the advertiser's delivered
                advertising value. Earnings from participating are variable and paid as Site Cash (non-cashable
                store credit) — never guaranteed.</p>
              <p><b>Opt out anytime.</b> Uncheck below to join without social advertising, or turn it off later
                in Settings. Opting out never affects your membership.</p>
            </div>
          </ScrollArea>
          <div className="flex items-start gap-2 text-sm rounded-md border p-3">
            <Checkbox id="opt-in" checked={optIn} onCheckedChange={(v) => setOptIn(!!v)} className="mt-0.5" />
            <label htmlFor="opt-in" className="cursor-pointer">Yes — include my social accounts for advertising rewards (recommended). Uncheck to opt out; you can change this anytime.</label>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={confirm} disabled={busy} style={{ background: NAVY }}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining…</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> {optIn ? 'Agree & connect accounts' : 'Join without social ads'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <ExternalLink className="w-3 h-3" /> Full details are in the Social Advertising Disclosure — available anytime in Settings.
      </p>
    </div>
  );
}
