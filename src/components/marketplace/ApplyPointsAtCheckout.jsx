import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ApplyPointsAtCheckout — the OPT-IN "Apply my points" button shown at checkout on every priced item. The
 * user taps it to see how much of their points apply (a preview), then confirms to check out by card with
 * those points applied (funded by PayPal). Nothing auto-applies — the user always chooses.
 *
 * Props: listing (needs id + price_usd), onDone() called after a successful checkout.
 */
export default function ApplyPointsAtCheckout({ listing, onDone }) {
  const [preview, setPreview] = useState(null);   // null = not previewed yet
  const [busy, setBusy] = useState(false);

  if (!listing || !(listing.price_usd > 0)) return null;

  const doPreview = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('pointsApplyPreview', { listing_id: listing.id });
      if (res.data?.error) toast.error(res.data.error);
      else setPreview(res.data);
    } catch { toast.error('Could not check your points.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('hybridCheckout', { listing_id: listing.id, apply_points: true });
      if (res.data?.blocked) toast.error(res.data.message || 'Payment method unavailable');
      else if (res.data?.success) {
        if (res.data.approve_url) { toast.success('Redirecting to PayPal to finish payment…'); window.location.href = res.data.approve_url; return; }
        toast.success(res.data.message || 'Order placed.');
        setPreview(null);
        if (onDone) onDone();
      } else toast.error(res.data?.error || res.data?.message || 'Checkout failed');
    } catch (e) { toast.error(e?.data?.error || e.message || 'Checkout failed'); }
    finally { setBusy(false); }
  };

  if (!preview) {
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={doPreview} title="Apply your Site Cash to this purchase">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wallet className="w-4 h-4 mr-1" /> Apply my Site Cash</>}
      </Button>
    );
  }

  if (!(preview.points_applicable > 0)) {
    return <span className="text-xs text-slate-400">No Site Cash to apply</span>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-emerald-700 font-semibold">−${preview.savings_usd.toFixed(2)} Site Cash · card pays ${preview.card_after_points_usd.toFixed(2)}</span>
      <Button size="sm" disabled={busy} onClick={confirm}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
      </Button>
      <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setPreview(null)}>cancel</button>
    </div>
  );
}
