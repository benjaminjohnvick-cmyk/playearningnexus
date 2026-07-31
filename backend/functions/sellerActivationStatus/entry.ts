import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { sellerCashbackRequiresActivation, sellerUserCommitmentMonths, pointValueUsd } from "../../sdk/revenue.ts";
import { isSellerActivated, pendingCashbackPoints } from "../../sdk/seller-activation.ts";

// sellerActivationStatus — read-only state for the seller onboarding UI: is the seller activated as a
// member, how much cash-back is currently LOCKED awaiting one-click activation, and the commitment term
// they'd agree to. Drives whether the "unlock your cash-back" banner shows.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const pending = pendingCashbackPoints(user as Record<string, unknown>);
    const activated = isSellerActivated(user as Record<string, unknown>);
    const requiresActivation = sellerCashbackRequiresActivation();

    return Response.json({
      activated,
      requires_activation: requiresActivation,
      // Show the banner when the gate is on, the seller hasn't activated, and there's cash-back to unlock.
      should_prompt: requiresActivation && !activated && pending > 0,
      pending_cashback_points: pending,
      pending_cashback_usd: Math.round(pending * pointValueUsd() * 100) / 100,
      commitment_months: sellerUserCommitmentMonths(),
      commitment_until: (user as Record<string, unknown>).seller_user_commitment_until ?? null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
