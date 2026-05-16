import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { monthly_amount } = await req.json();

    if (!monthly_amount || monthly_amount <= 0) {
      return Response.json({ error: 'monthly_amount required' }, { status: 400 });
    }

    // Calculate users needed ($4/day per person = $120/month)
    const earningsPerPersonPerMonth = 4 * 30; // $120
    const usersNeeded = Math.ceil(monthly_amount / earningsPerPersonPerMonth);

    // Get family members on this account
    const familyMembers = await base44.asServiceRole.entities.BNPLFamilyMember.filter({
      primary_user_id: user.id,
      status: 'active',
    });

    const canActivateBNPL = familyMembers.length >= usersNeeded;

    return Response.json({
      monthly_payment: monthly_amount,
      earnings_per_person_monthly: earningsPerPersonPerMonth,
      users_needed_to_cover: usersNeeded,
      current_family_members: familyMembers.length,
      can_activate_bnpl: canActivateBNPL,
      deficit: Math.max(0, usersNeeded - familyMembers.length),
      family_members: familyMembers.map(fm => ({
        id: fm.id,
        name: fm.member_name,
        email: fm.member_email,
        status: fm.status,
      })),
    });
  } catch (error) {
    console.error('BNPL calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});