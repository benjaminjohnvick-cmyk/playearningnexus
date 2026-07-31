import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { sellerCashbackRequiresActivation, sellerUserCommitmentMonths, pointValueUsd } from "../../sdk/revenue.ts";
import { isSellerActivated, pendingCashbackPoints, isSeller, deriveSellerUsername, sellerLevel } from "../../sdk/seller-activation.ts";

// sellerActivationStatus — read-only state for the seller onboarding UI: is the seller activated as a
// member, how much cash-back is currently LOCKED awaiting one-click activation, and the commitment term
// they'd agree to. Drives whether the "unlock your cash-back" banner shows.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const u = user as Record<string, unknown>;
    const pending = pendingCashbackPoints(u);
    const activated = isSellerActivated(u);
    const requiresActivation = sellerCashbackRequiresActivation();
    const seller = isSeller(u);

    return Response.json({
      // Seller identity (one-click "become a seller"; everyone can).
      is_seller: seller,
      seller_username: (u.seller_username as string) || deriveSellerUsername(u),
      level: sellerLevel(u),   // active-seller recognition (no points): curated_count / active_days
      // Member activation (unlocks locked cash-back / curator points).
      activated,
      requires_activation: requiresActivation,
      // Prompt to become a seller if they aren't one; prompt to activate if they have locked points.
      should_prompt_signup: !seller,
      should_prompt: requiresActivation && !activated && pending > 0,
      pending_cashback_points: pending,
      pending_cashback_usd: Math.round(pending * pointValueUsd() * 100) / 100,
      commitment_months: sellerUserCommitmentMonths(),
      commitment_until: u.seller_user_commitment_until ?? null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
