import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Purchases a head-to-head contest power-up, deducting virtual currency from the
// buyer and recording a ContestPowerUp. Called from HeadToHeadContest.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { contest_id, power_up_type, target_user_id } = body;

    const VALID = ['stun', 'pause', 'skip_turn'];
    if (!contest_id || !VALID.includes(power_up_type)) {
      return Response.json(
        { error: 'contest_id and a valid power_up_type (stun|pause|skip_turn) are required' },
        { status: 400 }
      );
    }

    const COST = 0.5; // matches ContestPowerUp.cost default
    const balance = user.virtual_currency || 0;
    if (balance < COST) {
      return Response.json(
        { error: 'Insufficient balance', required: COST, balance },
        { status: 402 }
      );
    }

    // Deduct the cost from the buyer
    await base44.asServiceRole.entities.User.update(user.id, {
      virtual_currency: balance - COST,
    });

    // Record the power-up
    const powerUp = await base44.asServiceRole.entities.ContestPowerUp.create({
      user_id: user.id,
      contest_id,
      power_up_type,
      cost: COST,
      target_user_id: target_user_id || null,
      used_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      power_up: powerUp,
      remaining_balance: balance - COST,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Purchase failed' }, { status: 500 });
  }
});
