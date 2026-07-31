import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Check, Loader2, BadgeCheck, Coins } from "lucide-react";
import { toast } from "sonner";

/**
 * SellerDealBanner — prominently advertises the seller deal and lets any user open a storefront in ONE
 * click. The deal: keep 100% of your own sale + 10% back in points. Catalog products you resell from your
 * storefront pay 10% back in points (the AI fulfills; you don't ship). Since fulfillment is automated and
 * the economy is closed-loop, every user can become a seller instantly.
 */
export default function SellerDealBanner({ compact = false, onChanged }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    try {
      const res = await base44.functions.invoke('sellerActivationStatus', {});
      setStatus(res?.data || null);
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    let alive = true;
    (async () => { await refresh(); if (alive) setLoading(false); })();
    return () => { alive = false; };
  }, []);

  const becomeSeller = async () => {
    if (!agreed) { toast.error('Please check the box to agree to the seller + member terms first.'); return; }
    setWorking(true);
    try {
      const res = await base44.functions.invoke('sellerSignupOneClick', { agree_seller_and_user: true });
      if (res?.data?.is_seller) {
        toast.success(`🏪 Your storefront is open, @${res.data.seller_username}!`);
        await refresh();
        if (onChanged) onChanged(res.data);
      } else {
        toast.error(res?.data?.message || 'Could not open your storefront. Please try again.');
      }
    } catch {
      toast.error('Storefront service temporarily unavailable. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return null;

  const isSeller = !!status?.is_seller;
  const username = status?.seller_username;
  const level = status?.level || {};

  // Already a seller → compact recognition strip with the advertised deal + active-seller progress.
  if (isSeller) {
    return (
      <div className="mb-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="w-5 h-5 text-yellow-300" />
          You're a seller{username ? <> · <span className="opacity-90">@{username}</span></> : null} — keep <strong>100%</strong> of your sale + <strong>10% back</strong> in points
        </div>
        {level?.is_active_seller ? (
          <span className="text-xs bg-white/20 rounded-full px-2 py-1 font-semibold">⭐ Active Seller</span>
        ) : (
          <span className="text-[11px] opacity-90">
            {level.curated_count || 0}/{level.needed_products || 300} products · {level.active_days || 0}/{level.needed_days || 30} days to Active Seller
          </span>
        )}
      </div>
    );
  }

  // Not a seller yet → prominent advertise + one-click open.
  return (
    <Card className="mb-6 border-0 shadow-lg overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-yellow-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-black mb-1 flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-300" /> Sell and keep 100% — plus 10% back in points
            </h3>
            <p className="text-white/90 text-sm mb-3">
              Open a storefront in one tap. Keep <strong>100%</strong> of everything you sell, and earn
              <strong> 10% back in points</strong> on top. Resell catalog products you love and we handle
              fulfillment — you still get 10% back when they sell. No fees, no shipping to manage.
            </p>

            <label className="flex items-start gap-2 text-sm text-white/90 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-emerald-300"
              />
              <span>
                I agree to the <strong>seller terms</strong> and to use the site as a seller and member for
                <strong> one year</strong>. Points are closed-loop credit I spend on the site — not cash.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={becomeSeller}
                disabled={working || !agreed}
                className="bg-white text-emerald-700 hover:bg-white/90 font-semibold px-6"
              >
                {working ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Open my storefront — one tap</>
                )}
              </Button>
              <span className="text-xs text-white/70">Free · no card · your username is your store</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
