import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Premium PPC enrollment (NO-PENALTY POINTS model): records T&C consent and enrolls the user
// (1:1 advertiser match). There is NO card charge, NO upfront advance, and NO debt — the user earns
// points as they go, and a missed day simply doesn't earn.
const TERMS_VERSION = 'v1';

function EnrollForm({ onDone }) {
  const [consent, setConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setError('Please accept the Premium PPC terms to continue.'); return; }
    setProcessing(true);
    setError(null);
    try {
      // Enroll (checks the 1:1 advertiser slot + records consent). No card is required or charged.
      const enroll = await base44.functions.invoke('premiumPPCEnroll', {
        consent: { accepted: true, terms_version: TERMS_VERSION },
      });
      onDone?.({ enroll: enroll.data });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Enrollment failed.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        You earn points as you go — up to <strong>$4/day</strong>, up to <strong>$1,460/year</strong>.
        A day you don’t participate simply doesn’t earn. There’s <strong>no charge, no debt, and nothing to repay</strong>.
        Points are redeemable in the catalog.
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to the Premium PPC terms: I earn points by participating (up to $4/day), a missed day
          simply doesn’t earn, and I am <strong>never charged and never owe anything</strong>. Points are
          redeemable in the catalog and are not withdrawable as cash.
        </span>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={processing || !consent}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold py-3"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling…</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Join Premium PPC — start earning</>
        )}
      </Button>
    </form>
  );
}

export default function PremiumPPCEnrollModal({ isOpen, onClose, onEnrolled }) {
  const [done, setDone] = useState(null);

  const handleDone = (result) => {
    setDone(result);
    onEnrolled?.(result);
    setTimeout(() => { setDone(null); onClose?.(); }, 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" /> Join Premium PPC
          </DialogTitle>
          <DialogDescription>
            Earn points as you go — up to $4/day, up to $1,460/year. No card, no charge, no debt.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-lg border border-green-200">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black">You’re enrolled! 🎉</p>
              <p className="text-sm">Start participating to earn points — up to $4/day, up to $1,460/year.</p>
            </div>
          </div>
        ) : (
          <EnrollForm onDone={handleDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}
