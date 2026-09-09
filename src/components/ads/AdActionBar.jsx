import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// AdActionBar — the two-button engagement bar that drops onto EVERY advertisement.
//   • Buy Now    → records a buy_now signal, then routes to the purchase step (outbound link or on-platform checkout).
//   • Interested → toggles the product into the viewer's favorites (a mid-funnel intent signal).
// Both calls go through adEngagementRecord, which stores the signal for advertiser stats + the AI optimizer.
// Reusable across ad surfaces (feed cards, sponsored listings, marketplace, interstitials) — pass `compact` in
// tight units. Reads a flexible `ad` shape so each surface can drop it in without reshaping its data.
export default function AdActionBar({
  ad = {},
  placement = "feed",
  compact = false,
  initialFavorited = false,
  onRequireSignIn,
  className = "",
}) {
  const [favorited, setFavorited] = useState(!!initialFavorited);
  const [busy, setBusy] = useState(null); // "interested" | "buy_now" | null

  const payload = (kind) => ({
    kind,
    ad_id: ad.id || ad.ad_id || "",
    advertiser_id: ad.advertiser_id || ad.advertiserId || null,
    campaign_id: ad.campaign_id || ad.campaignId || null,
    placement,
    product: {
      name: ad.product_name || ad.title || ad.name || "",
      image_url: ad.image_url || ad.image || "",
      product_url: ad.product_url || ad.url || "",
      category: ad.category || "",
    },
  });

  const record = async (kind) => {
    setBusy(kind);
    try {
      const res = await base44.functions.invoke("adEngagementRecord", payload(kind));
      if (res?.sign_in_required) {
        if (onRequireSignIn) onRequireSignIn();
        else { toast("Sign in to save and buy"); window.location.href = "/login"; }
        return null;
      }
      return res;
    } catch {
      toast.error("Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const onInterested = async (e) => {
    e?.stopPropagation?.();
    const optimistic = !favorited;
    setFavorited(optimistic);
    const res = await record("interested");
    if (!res) { setFavorited(!optimistic); return; }
    if (typeof res.favorited === "boolean") setFavorited(res.favorited);
    toast.success(res.favorited ? "Added to your favorites" : "Removed from favorites");
  };

  const onBuyNow = async (e) => {
    e?.stopPropagation?.();
    const res = await record("buy_now");
    if (!res) return;
    const next = res.next;
    if (next?.action === "outbound" && next.url) window.open(next.url, "_blank", "noopener");
    else if (next?.action === "checkout") window.location.href = `/store?buy=${encodeURIComponent(next.ad_id || "")}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        onClick={onBuyNow}
        disabled={busy === "buy_now"}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
      >
        {busy === "buy_now" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
        Buy Now
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onInterested}
        disabled={busy === "interested"}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from favorites" : "I'm interested — add to favorites"}
        className={`gap-1.5 ${compact ? "px-2.5" : ""} ${favorited ? "border-blue-600 text-blue-700 bg-blue-50" : "text-gray-700"}`}
      >
        {busy === "interested"
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Heart className={`w-4 h-4 ${favorited ? "fill-blue-600 text-blue-600" : ""}`} />}
        {!compact && "Interested"}
      </Button>
    </div>
  );
}
