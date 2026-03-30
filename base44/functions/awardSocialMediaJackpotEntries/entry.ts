import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform } = await req.json();
    
    if (!platform) {
      return Response.json({ error: 'Missing platform' }, { status: 400 });
    }

    // Award jackpot entries based on platform
    const entryCount = {
      facebook: 50,
      twitter: 50,
      instagram: 75,
      snapchat: 75
    }[platform] || 50;

    // Get or create today's jackpot entry record
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user already has entry for this platform today
    const existingEntry = await base44.entities.ReferralJackpot.filter({
      period: today,
      entry_breakdown: {
        [user.id]: { [platform]: true }
      }
    }).catch(() => []);

    if (existingEntry.length > 0) {
      return Response.json({ 
        success: false, 
        message: 'You already connected this platform today',
        entriesAwarded: 0 
      });
    }

    // Create or update user's profile with total jackpot entries
    const updatedUser = await base44.auth.updateMe({
      total_jackpot_entries: (user.total_jackpot_entries || 0) + entryCount,
      last_social_connection: new Date().toISOString()
    });

    return Response.json({
      success: true,
      entriesAwarded: entryCount,
      totalEntries: updatedUser.total_jackpot_entries,
      message: `Congratulations! You earned ${entryCount} bonus jackpot entries for connecting ${platform}!`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});