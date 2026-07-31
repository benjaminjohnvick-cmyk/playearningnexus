import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Check, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

/**
 * SellerActivateCashback — the seller's ONE-TAP onboarding step to use the site as a member and unlock
 * their held cash-back. A member seller keeps 100% of every sale AND earns 10% back in cash-back points,
 * but those points stay LOCKED until the seller agrees to use the platform as both a seller and a member
 * for a year. This banner shows that held balance and unlocks it in one click (sellerActivateMembership).
 * Nothing is converted to cash — it's closed-loop credit the seller spends on the site.
 */
export default function SellerActivateCashback({ onActivated }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('sellerActivationStatus', {});
        if (alive) setStatus(res?.data || null);
      } catch {
        /* non-fatal — banner just won't show */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const activate = async () => {
    if (!agreed) {
      toast.error('Please check the box to agree to the one-year terms first.');
      return;
    }
    setActivating(true);
    try {
      const res = await base44.functions.invoke('sellerActivateMembership', { agree_seller_and_user: true });
      if (res?.data?.activated) {
        setDone(true);
        const swept = res?.data?.swept_cashback_points || 0;
        toast.success(swept > 0 ? `🎉 Unlocked ${swept} cash-back points!` : '✅ Member access is on.');
        if (onActivated) onActivated(res.data);
      } else {
        toast.error(res?.data?.message || 'Could not activate right now. Please try again.');
      }
    } catch {
      toast.error('Activation service temporarily unavailable. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  if (loading || done) return null;
  if (!status?.should_prompt) return null;

  const pts = status.pending_cashback_points || 0;
  const usd = status.pending_cashback_usd || 0;
  const months = status.commitment_months || 12;

  return (
    <Card className="mb-6 border-0 shadow-lg overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-yellow-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-yellow-300" />
              <h3 className="text-xl font-bold">You have {pts} cash-back points waiting</h3>
            </div>
            <p className="text-white/90 text-sm mb-3">
              You keep <strong>100%</strong> of every sale <em>and</em> earn <strong>10% back</strong> in
              cash-back points{usd > 0 ? <> (about <strong>${usd.toFixed(2)}</strong> in on-site credit)</> : null}.
              To spend them, activate your account to use the site as a member too — one tap, no payment.
            </p>

            <label className="flex items-start gap-2 text-sm text-white/90 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-emerald-300"
              />
              <span>
                I agree to use the site as a <strong>seller and a member</strong> for {months === 12 ? 'one year' : `${months} months`}.
                My cash-back is <strong>closed-loop credit</strong> I can spend on the site — it is not cash and isn't withdrawable.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={activate}
                disabled={activating || !agreed}
                className="bg-white text-emerald-700 hover:bg-white/90 font-semibold px-6"
              >
                {activating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Activate &amp; unlock my cash-back</>
                )}
              </Button>
              <span className="text-xs text-white/70">One tap — no card, no fee.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
