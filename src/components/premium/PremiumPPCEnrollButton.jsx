import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Info, Check, X, ShieldCheck, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// PremiumPPCEnrollButton — a ONE-CLICK enroll button for the PPC survey advance, plus a "What does this
// mean?" explanation. Legal/ethical by design: this is clickwrap consent — the agreement (survey
// commitment + permission to post #ad-labeled ads on your own social accounts + non-cashable points) is
// stated clearly and conspicuously right at the button, nothing is pre-agreed or hidden, and full detail
// is one tap away. Enrolling records explicit consent (accepted + terms_version + social_ads).
export default function PremiumPPCEnrollButton() {
  const [offer, setOffer] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        base44.functions.invoke('premiumPPCOffer', {}),
        base44.functions.invoke('premiumPPCStatus', {}),
      ]);
      setOffer(o.data || null);
      setStatus(s.data || null);
    } catch { /* leave null */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const usd = (n) => `$${Number(n || 0).toLocaleString()}`;
  const pts = (n) => `${Number(n || 0).toLocaleString()} pts`;

  async function enroll() {
    if (!offer) return;
    setBusy(true);
    try {
      // Clickwrap: the click itself is the affirmative, informed consent shown above the button.
      const r = await base44.functions.invoke('premiumPPCEnroll', {
        consent: { accepted: true, terms_version: offer.terms_version, social_ads: true },
      });
      if (r.data?.error) {
        if (r.data.requires_lockout_mode) toast.error('Re-enrollment requires lockout mode — set your daily survey time first.');
        else toast.error(r.data.error);
        return;
      }
      toast.success(r.data?.note || 'Enrolled! Your points are in your balance.');
      setExplain(false);
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not enroll.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  if (!offer?.upfront) return null;                 // only shown when the up-front offer is live
  if (status?.enrolled) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <ShieldCheck className="h-5 w-5" /> You're enrolled in the PPC survey program.
          </div>
          <p className="mb-3 text-xs text-emerald-700">
            Next step: connect your social accounts so the labeled #ad posts can run there. You connect each
            one securely (you log in and approve) — we can't and don't scan or access accounts you haven't linked.
          </p>
          <Link to={createPageUrl('SocialMediaSetup')}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"><Link2 className="mr-1 h-4 w-4" /> Connect your social accounts</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  const slots = status?.slots;
  const soldOut = slots && slots.available <= 0;

  return (
    <>
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-lg font-bold">Get {usd(offer.member?.headline_usd)} up front</span>
            {slots && <Badge className="ml-auto bg-white/15 text-white">{Math.max(0, slots.available)} of {slots.advertisers} spots</Badge>}
          </div>
          <p className="text-sm text-white/90">
            {pts(offer.member?.headline_points)} added to your balance now — spend it on anything through the site.
            Just do ~{offer.member?.minutes_per_day} min of surveys a day for {offer.member?.commitment_days} days (catch up anytime).
          </p>

          {/* Clickwrap consent — clear, conspicuous, right at the button. */}
          <div className="mt-3 rounded-lg bg-white/10 p-3 text-xs text-white/90">
            By enrolling you agree to the Premium PPC terms and to us posting AI-created, clearly labeled
            <b> #ad</b> posts for our advertisers on your connected social accounts. Value is delivered as
            points (1¢ each) — store credit spendable at any store through the site, <b>not withdrawable as cash</b>.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="bg-white text-indigo-700 hover:bg-white/90" disabled={busy || soldOut} onClick={enroll}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              {soldOut ? 'Spots full — check back' : `Agree & enroll — get ${pts(offer.member?.headline_points)}`}
            </Button>
            <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setExplain(true)}>
              <Info className="mr-1 h-4 w-4" /> What does this mean?
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Explanation modal */}
      {explain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-gray-900"><Info className="h-5 w-5 text-indigo-600" /> What this means</div>
              <button onClick={() => setExplain(false)} aria-label="Close"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <p><b>What you get:</b> {usd(offer.member?.headline_usd)} of value — {pts(offer.member?.headline_points)} — added to your balance right away.</p>
              <p><b>How you can use it:</b> points are store credit worth 1¢ each, spendable at any store through the site (you can buy anything from anywhere). They are <b>not</b> withdrawable as cash.</p>
              <p><b>What you commit to:</b> completing about {offer.member?.minutes_per_day} minutes of surveys per day for {offer.member?.commitment_days} days. You can do extra to catch up — it's flexible over the year. You never repay anything and are never charged.</p>
              <p><b>Social advertising consent:</b> to receive the advance you agree to let us post AI-created ads for our paying advertisers to your connected social accounts. Every post is clearly labeled <b>#ad · Sponsored</b>. You can disconnect an account or leave the program anytime.</p>
              <p><b>If you fall behind:</b> if you spend your points and stop keeping up with surveys, the surveys pause until a new advertiser spot opens — you keep all your points, and nothing is owed. Rejoining later uses a daily "lockout" reminder to help you keep pace.</p>
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">{offer.disclaimer}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setExplain(false)}>Close</Button>
              <Button className="flex-1" disabled={busy || soldOut} onClick={enroll}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Agree & enroll
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
