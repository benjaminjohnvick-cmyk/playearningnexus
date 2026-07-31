import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Store, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * AddToStorefrontButton — on a platform-catalog product card, lets a user add that product to their own
 * storefront in one click. It becomes a listing under their username; the AI fulfills it and the user earns
 * 10% back in points when it sells. First add auto-opens their seller identity (no separate signup needed).
 */
export default function AddToStorefrontButton({ listing, onAdded }) {
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  if (!listing || listing.source !== 'platform_catalog') return null;

  const add = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('addCatalogToStorefront', { catalog_listing_id: listing.id });
      if (res?.data?.success) {
        setAdded(true);
        toast.success(res.data.already
          ? 'Already in your storefront.'
          : `Added to your storefront (@${res.data.seller_username}). 10% back in points if it sells.`);
        if (onAdded) onAdded(res.data);
      } else {
        toast.error(res?.data?.error || res?.data?.message || 'Could not add to your storefront.');
      }
    } catch (e) {
      toast.error(e?.data?.error || 'Could not add to your storefront right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || added}
      onClick={add}
      title="Resell this in your storefront — earn 10% back in points when it sells (we fulfill it)"
      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
    >
      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        : added ? <Check className="w-4 h-4 mr-1" />
        : <Store className="w-4 h-4 mr-1" />}
      {added ? 'In your store' : 'Sell this'}
    </Button>
  );
}
