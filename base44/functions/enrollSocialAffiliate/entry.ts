import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * enrollSocialAffiliate
 *
 * Called when a new user registers OR manually opts in.
 * - Creates or updates their MLMNode
 * - Builds the 3-level upline chain from Referral records
 * - Records ULA acceptance
 *
 * Payload: { user_id, accepted_ula, social_platforms_connected: [] }
 * Also can be called with just { user_id } to build the MLM chain for existing users.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, accepted_ula, social_platforms_connected } = await req.json();

    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

    // 1. Find direct referral record for this user
    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: user_id });
    const referral = referrals[0] || null;

    let level1 = null, level2 = null, level3 = null;

    if (referral) {
      level1 = referral.referrer_user_id;

      // Find level 2: the referral record where level1 is the referred user
      if (level1) {
        const l2referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: level1 });
        if (l2referrals.length) {
          level2 = l2referrals[0].referrer_user_id;

          // Find level 3
          if (level2) {
            const l3referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: level2 });
            if (l3referrals.length) {
              level3 = l3referrals[0].referrer_user_id;
            }
          }
        }

        // Also update the Referral record with level IDs for fast lookup
        await base44.asServiceRole.entities.Referral.update(referral.id, {
          level_1_referrer_id: level1,
          level_2_referrer_id: level2 || null,
          level_3_referrer_id: level3 || null
        });
      }
    }

    // 2. Create or update MLMNode
    const existingNodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id });
    const nodeData = {
      user_id,
      level_1_parent_id: level1,
      level_2_parent_id: level2,
      level_3_parent_id: level3,
      is_social_affiliate: accepted_ula === true ? true : (existingNodes[0]?.is_social_affiliate || false),
      accepted_ula: accepted_ula === true ? true : (existingNodes[0]?.accepted_ula || false),
      ula_accepted_at: accepted_ula === true ? new Date().toISOString() : (existingNodes[0]?.ula_accepted_at || null),
      social_platforms_connected: social_platforms_connected || existingNodes[0]?.social_platforms_connected || []
    };

    let node;
    if (existingNodes.length) {
      node = await base44.asServiceRole.entities.MLMNode.update(existingNodes[0].id, nodeData);
    } else {
      node = await base44.asServiceRole.entities.MLMNode.create(nodeData);
    }

    return Response.json({
      success: true,
      user_id,
      mlm_chain: { level_1: level1, level_2: level2, level_3: level3 },
      is_social_affiliate: node.is_social_affiliate,
      node_id: node.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});