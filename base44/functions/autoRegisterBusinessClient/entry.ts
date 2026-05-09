import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Called automatically after any business-user payment succeeds.
 * If the user doesn't already have a BusinessClient record, AI creates one
 * and triggers verification. If one exists and is suspended, it re-evaluates.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support entity automation payload (Transaction create trigger)
    let { user_id, service_type, amount_paid, description } = body;
    if (!user_id && body?.data?.user_id) {
      user_id = body.data.user_id;
      service_type = service_type || body.data.transaction_type;
      amount_paid = amount_paid || body.data.amount;
      description = description || body.data.notes;
    }

    if (!user_id) return Response.json({ error: 'Missing user_id' }, { status: 400 });

    // Fetch the user
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const user = users[0];
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Check if BusinessClient already exists and is active — nothing to do
    const existing = await base44.asServiceRole.entities.BusinessClient.filter({ owner_user_id: user_id });
    const client = existing[0];

    if (client && client.account_status === 'active') {
      return Response.json({ message: 'Already an active business client', business_client_id: client.id });
    }

    // Use AI to extract business info from the user's profile + payment context
    const aiPrompt = `A user just paid for a business service on GamerGain (a gaming platform). 
Auto-generate a BusinessClient profile for this user based on the available data.

User Info:
- Name: ${user.full_name || 'Unknown'}
- Email: ${user.email}
- Service Purchased: ${service_type || 'Business service'}
- Amount Paid: $${amount_paid || 0}
- Service Description: ${description || 'N/A'}
- Existing Total Earnings: $${user.total_earnings || 0}

Generate a realistic but minimal BusinessClient profile. Use their name as the company name if no company name is known.
The fact that they paid for a business service is strong evidence they are a legitimate business user.

Respond with JSON:
- company_name (string): derived from user name or context
- tagline (string): short tagline based on service type
- bio (string): brief auto-generated bio
- is_legitimate (boolean): true since they paid for a real service (should almost always be true)
- notes (string): brief reasoning`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          tagline: { type: 'string' },
          bio: { type: 'string' },
          is_legitimate: { type: 'boolean' },
          notes: { type: 'string' }
        }
      }
    });

    const now = new Date().toISOString();

    let businessClientId;

    if (client) {
      // Update existing suspended/pending record
      await base44.asServiceRole.entities.BusinessClient.update(client.id, {
        account_status: aiResult.is_legitimate ? 'active' : 'pending',
        onboarding_completed: aiResult.is_legitimate,
        tagline: client.tagline || aiResult.tagline,
        bio: client.bio || aiResult.bio,
      });
      businessClientId = client.id;
    } else {
      // Create new BusinessClient record
      const newClient = await base44.asServiceRole.entities.BusinessClient.create({
        owner_user_id: user_id,
        company_name: aiResult.company_name || user.full_name,
        contact_email: user.email,
        tagline: aiResult.tagline,
        bio: aiResult.bio,
        account_status: aiResult.is_legitimate ? 'active' : 'pending',
        onboarding_completed: aiResult.is_legitimate,
        social_links: {},
      });
      businessClientId = newClient.id;
    }

    // Log the transaction context
    await base44.asServiceRole.entities.Transaction.create({
      user_id,
      amount: amount_paid || 0,
      transaction_type: 'priority_payment',
      status: 'completed',
      notes: `Auto business registration: ${service_type || 'business service'}. ${aiResult.notes}`,
    }).catch(() => null);

    // Notify user
    if (user.email) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🎮 You\'ve Been Registered as a GamerGain Business Client!',
        body: `Hi ${user.full_name},\n\nBecause you just purchased "${service_type || 'a business service'}" on GamerGain, you've been automatically registered as a Business Client.\n\nCompany: ${aiResult.company_name}\nStatus: ${aiResult.is_legitimate ? 'Active ✅' : 'Pending Review'}\n\nYou now have access to the Developer Dashboard and business features.\n\n— The GamerGain Team`,
        from_name: 'GamerGain',
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      business_client_id: businessClientId,
      company_name: aiResult.company_name,
      status: aiResult.is_legitimate ? 'active' : 'pending',
      notes: aiResult.notes,
    });

  } catch (error) {
    console.error('autoRegisterBusinessClient error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});