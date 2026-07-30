import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * PremiumEarnedBanner — shows a one-tap Premium offer ONLY once the user has earned it by hitting the
 * daily survey goal on enough days (server-verified via premiumEligibility). The tap itself captures the
 * two consents (clearly-marked #ad social posts + the one-year term) and enrolls via premiumAcceptOffer.
 * This is NOT silent enrollment: nothing changes until the user reads the terms and taps Accept.
 */
export default function PremiumEarnedBanner({ user, onEnrolled }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('premiumEligibility', {});
        if (alive) setStatus(res?.data || null);
      } catch {
        /* non-fatal — banner just won't show */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const accept = async () => {
    if (!agreed) {
      toast.error('Please check the box to agree to the program terms first.');
      return;
    }
    setAccepting(true);
    try {
      const res = await base44.functions.invoke('premiumAcceptOffer', {
        social_consent: true,
        annual_agreement: true,
      });
      if (res?.data?.enrolled) {
        setEnrolled(true);
        toast.success("🎉 Premium unlocked! Your surveys now pay cash back.");
        if (onEnrolled) onEnrolled();
      } else {
        toast.error(res?.data?.message || 'Could not enroll right now. Please try again.');
      }
    } catch {
      toast.error('Enrollment service temporarily unavailable. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || enrolled) return null;
  if (!status?.eligible) return null;

  return (
    <Card className="mb-6 border-0 shadow-lg overflow-hidden bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-yellow-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <h3 className="text-xl font-bold">You've earned Premium!</h3>
            </div>
            <p className="text-white/90 text-sm mb-3">
              You've completed your daily surveys on <strong>{status.qualifying_days}</strong> days — you've
              earned a spot in Premium. As a Premium member your surveys pay <strong>24% cash back</strong>{' '}
              (instead of points), plus you earn points back on every purchase.
            </p>

            <label className="flex items-start gap-2 text-sm text-white/90 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-purple-300"
              />
              <span>
                By accepting, I agree to post occasional <strong>clearly-marked #ad</strong> promotional
                content and to the <strong>one-year program terms</strong>. My membership continues year to
                year as long as I keep up my daily surveys.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={accept}
                disabled={accepting || !agreed}
                className="bg-white text-purple-700 hover:bg-white/90 font-semibold px-6"
              >
                {accepting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Accept Premium</>
                )}
              </Button>
              <span className="text-xs text-white/70">One tap — no payment, no card. You earned it.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
