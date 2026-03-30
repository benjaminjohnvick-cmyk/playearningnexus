import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { perk_id } = await req.json();
    if (!perk_id) return Response.json({ error: 'Missing perk_id' }, { status: 400 });

    // Fetch perk
    const perks = await base44.entities.RewardPerk.filter({ id: perk_id });
    const perk = perks[0];
    if (!perk) return Response.json({ error: 'Perk not found' }, { status: 404 });
    if (perk.status !== 'active') return Response.json({ error: 'Perk unavailable' }, { status: 400 });

    // Check balance
    if (user.commission_balance < perk.cost_balance) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Check stock for limited edition
    if (perk.is_limited_edition && perk.redeemed_count >= perk.available_quantity) {
      return Response.json({ error: 'Perk sold out' }, { status: 400 });
    }

    // Create redemption record
    const expiresAt = perk.duration_days ? new Date(Date.now() + perk.duration_days * 86400000).toISOString() : null;
    const redemption = await base44.entities.RedemptionRecord.create({
      user_id: user.id,
      user_name: user.full_name,
      perk_id: perk.id,
      perk_type: perk.perk_type,
      perk_title: perk.title,
      cost_balance: perk.cost_balance,
      balance_before: user.commission_balance,
      balance_after: user.commission_balance - perk.cost_balance,
      redeemed_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true,
    });

    // Deduct balance from user
    await base44.auth.updateMe({
      commission_balance: user.commission_balance - perk.cost_balance,
    });

    // Update perk redeemed count
    await base44.asServiceRole.entities.RewardPerk.update(perk.id, {
      redeemed_count: (perk.redeemed_count || 0) + 1,
      status: perk.is_limited_edition && (perk.redeemed_count || 0) + 1 >= perk.available_quantity ? 'sold_out' : perk.status,
    });

    return Response.json({
      success: true,
      redemption: redemption,
      new_balance: user.commission_balance - perk.cost_balance,
      expires_at: expiresAt,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});