import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has social connections (skip if they do)
    const existingConnections = await base44.entities.SocialMediaConnection.filter({
      user_id: user.id
    });

    if (existingConnections.length > 0) {
      return Response.json({
        success: false,
        message: 'User already enrolled',
        connectionsCreated: 0
      });
    }

    const platforms = ['facebook', 'twitter', 'instagram', 'snapchat'];
    const created = [];

    // Create dummy connections for all platforms (auto-posting enabled by default)
    // These will use OAuth tokens when user actually connects
    for (const platform of platforms) {
      try {
        const connection = await base44.entities.SocialMediaConnection.create({
          user_id: user.id,
          platform,
          account_id: `pending_${user.id}_${platform}`,
          account_name: `Pending ${platform} connection`,
          access_token: 'pending',
          is_active: false,
          auto_posting_enabled: true,
          connected_at: new Date().toISOString()
        });

        created.push({
          platform,
          status: 'pending_enrollment',
          connectionId: connection.id
        });
      } catch (error) {
        // Continue even if one fails
        console.error(`Failed to create ${platform} connection:`, error.message);
      }
    }

    // Award initial jackpot entries for signing up
    await base44.auth.updateMe({
      total_jackpot_entries: (user.total_jackpot_entries || 0) + 50,
      auto_social_posting_enrolled: true
    });

    return Response.json({
      success: true,
      connectionsCreated: created.length,
      enrolledPlatforms: created.map(c => c.platform),
      initialJackpotEntries: 50,
      message: 'User auto-enrolled in social posting with 50 jackpot entries!'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});