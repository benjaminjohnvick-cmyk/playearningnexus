import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct calls and entity automation payloads
    const businessClientId = body?.business_client_id || body?.event?.entity_id || body?.data?.id;

    if (!businessClientId) {
      return Response.json({ error: 'Missing business_client_id' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.BusinessClient.filter({ id: businessClientId });
    const client = records[0];

    if (!client) {
      return Response.json({ error: 'BusinessClient not found' }, { status: 404 });
    }

    // Only verify pending clients
    if (client.account_status !== 'pending') {
      return Response.json({ message: 'Client is not in pending state', status: client.account_status });
    }

    // Fetch associated DeveloperApplication
    const apps = await base44.asServiceRole.entities.DeveloperApplication.filter({ applied_user_id: client.owner_user_id });
    const app = apps[0];

    // Fetch associated PayoutPreference
    const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: client.owner_user_id });
    const pref = prefs[0];

    // Run AI verification
    const verifyPrompt = `You are a fraud prevention and business verification AI for GamerGain, a gaming platform.

Your job is to evaluate whether a new business client registration is legitimate or potentially fraudulent (e.g., a regular user trying to abuse the business payout system).

Business Client Details:
- Company Name: ${client.company_name || 'Not provided'}
- Bio: ${client.bio || 'Not provided'}
- Tagline: ${client.tagline || 'Not provided'}
- Contact Email: ${client.contact_email || 'Not provided'}
- Social Links: ${JSON.stringify(client.social_links || {})}
- Logo Uploaded: ${client.logo_url ? 'Yes' : 'No'}

Game Submission:
- Game Title: ${app?.game_title || 'Not provided'}
- Game Description: ${app?.game_description || 'Not provided'}
- Game Category: ${app?.game_category || 'Not provided'}
- Platforms: ${(app?.game_platform || []).join(', ') || 'Not provided'}
- Demo URL: ${app?.demo_url || 'Not provided'}
- Screenshots Uploaded: ${(app?.screenshot_urls || []).length > 0 ? 'Yes (' + app.screenshot_urls.length + ')' : 'No'}
- Status: ${app?.status || 'Not provided'}

Payout Setup:
- Payout Method: ${pref?.payout_method || 'Not provided'}
- PayPal Email: ${pref?.paypal_email ? 'Provided' : 'Not provided'}
- Minimum Threshold: $${pref?.minimum_payout_threshold || 'Not set'}

Fraud signals to check:
1. Does the company name look fake, generic, or like a personal name rather than a studio?
2. Is the bio meaningful and relevant to game development (or is it minimal/generic)?
3. Is the game submission complete with a real title, description, and screenshots?
4. Does the email domain look legitimate for a business (not suspicious burner emails)?
5. Are there active social/website links indicating a real business?
6. Is there any pattern suggesting this is a regular user trying to set up a fake business to extract payouts?

Be strict. When in doubt, reject. Legitimate game developers will have at minimum: a real studio name, game with a description, at least one screenshot, and a payout method.

Respond with JSON:
- approved (boolean): true only if this looks like a legitimate game developer/business
- confidence_score (number 0-100): your confidence in the decision
- rejection_reason (string or null): specific reason if rejected
- risk_flags (array of strings): any red flags detected
- notes (string): brief summary of your decision`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: verifyPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          approved: { type: 'boolean' },
          confidence_score: { type: 'number' },
          rejection_reason: { type: 'string' },
          risk_flags: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' }
        }
      }
    });

    const approved = aiResult.approved === true;
    const newStatus = approved ? 'active' : 'suspended';

    // Update the BusinessClient status
    await base44.asServiceRole.entities.BusinessClient.update(businessClientId, {
      account_status: newStatus,
      onboarding_completed: approved,
    });

    // Update the DeveloperApplication status if present
    if (app) {
      await base44.asServiceRole.entities.DeveloperApplication.update(app.id, {
        status: approved ? 'approved' : 'rejected',
        review_notes: aiResult.notes,
      });
    }

    // Notify the applicant by email
    if (client.contact_email) {
      const subject = approved
        ? `✅ Your GamerGain Developer Account is Approved!`
        : `❌ GamerGain Developer Application - Not Approved`;

      const emailBody = approved
        ? `Hi ${client.company_name},\n\nCongratulations! Your developer account has been verified and approved. You can now access the full Developer Dashboard and start earning.\n\nWelcome to GamerGain!\n— The GamerGain Team`
        : `Hi ${client.company_name},\n\nUnfortunately, your developer account application could not be approved at this time.\n\nReason: ${aiResult.rejection_reason || 'Your application did not meet our verification requirements.'}\n\nIf you believe this is an error, please contact our support team.\n\n— The GamerGain Team`;

      await base44.integrations.Core.SendEmail({
        to: client.contact_email,
        subject,
        body: emailBody,
        from_name: 'GamerGain'
      }).catch(() => {});
    }

    // Alert admin if rejected (potential fraud)
    if (!approved && aiResult.risk_flags?.length > 0) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `🚨 Suspicious Business Signup Blocked: ${client.company_name}`,
        body: `AI blocked a potentially fraudulent business signup.\n\nCompany: ${client.company_name}\nEmail: ${client.contact_email}\nRisk Flags: ${(aiResult.risk_flags || []).join(', ')}\nReason: ${aiResult.rejection_reason}\nConfidence: ${aiResult.confidence_score}/100`,
        from_name: 'GamerGain Security'
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      approved,
      confidence_score: aiResult.confidence_score,
      rejection_reason: aiResult.rejection_reason,
      risk_flags: aiResult.risk_flags,
      notes: aiResult.notes,
      new_status: newStatus
    });

  } catch (error) {
    console.error('Business verification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});