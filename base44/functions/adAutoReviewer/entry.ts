import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Triggered by entity automation when a new AdListing is created with status=pending
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const adId = body?.event?.entity_id || body?.ad_id;
  if (!adId) return Response.json({ error: 'No ad ID provided' }, { status: 400 });

  // Fetch the ad
  const ads = await base44.asServiceRole.entities.AdListing.filter({ id: adId });
  const ad = ads[0];
  if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });
  if (ad.status !== 'pending') return Response.json({ skipped: true, reason: 'Not pending' });

  // Score the ad with AI
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a brand safety reviewer for GamerGain, a gaming platform ad grid. Review this ad submission and score it.

Ad Details:
- Brand Name: "${ad.brand_name}"
- Tagline: "${ad.tagline || 'none'}"
- Landing URL: "${ad.landing_url}"
- Bid Amount: $${ad.bid_amount}
${ad.image_url ? `- Has image: yes` : '- Has image: no'}

Score the ad on these criteria (0-10 each):
1. brand_safety: Is content appropriate for a gaming audience (no adult, gambling, scam content)?
2. tagline_quality: Is the tagline compelling, clear, grammatically correct?
3. url_legitimacy: Does the URL look like a legitimate business (no suspicious TLDs, URL shorteners)?
4. overall_score: Overall quality score

Also provide:
- recommendation: "approve", "review", or "reject"
- rejection_reason: specific reason if rejecting (null if approving)
- improvement_suggestions: array of 2-3 specific improvements for the advertiser

Return JSON only.`,
    response_json_schema: {
      type: 'object',
      properties: {
        brand_safety: { type: 'number' },
        tagline_quality: { type: 'number' },
        url_legitimacy: { type: 'number' },
        overall_score: { type: 'number' },
        recommendation: { type: 'string' },
        rejection_reason: { type: 'string' },
        improvement_suggestions: { type: 'array', items: { type: 'string' } },
      }
    }
  });

  const { recommendation, rejection_reason, improvement_suggestions, overall_score, brand_safety } = result;

  // Auto-approve high-scoring safe ads, auto-reject unsafe ones, leave borderline for human review
  let newStatus = 'pending'; // leave for human
  if (recommendation === 'approve' && overall_score >= 7 && brand_safety >= 8) {
    newStatus = 'active';
  } else if (recommendation === 'reject' || brand_safety < 4) {
    newStatus = 'rejected';
  }

  // Update the ad status
  await base44.asServiceRole.entities.AdListing.update(adId, {
    status: newStatus,
    ...(newStatus === 'active' ? { approved_at: new Date().toISOString() } : {}),
  });

  // Find the advertiser and email them the review
  const users = await base44.asServiceRole.entities.User.filter({ id: ad.owner_user_id });
  const advertiser = users[0];

  if (advertiser?.email) {
    const statusLabel = newStatus === 'active' ? '✅ Approved' : newStatus === 'rejected' ? '❌ Rejected' : '👀 Under Review';
    const suggestions = (improvement_suggestions || []).map(s => `• ${s}`).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: advertiser.email,
      from_name: 'GamerGain Ad Grid',
      subject: `Ad Review: "${ad.brand_name}" — ${statusLabel}`,
      body: `Hi ${advertiser.full_name || 'Advertiser'},\n\nYour ad "${ad.brand_name}" has been reviewed by our AI system.\n\n📋 REVIEW RESULT: ${statusLabel}\nAI Score: ${overall_score}/10\nBrand Safety: ${brand_safety}/10\n\n${rejection_reason ? `❌ Reason: ${rejection_reason}\n\n` : ''}${suggestions ? `💡 Suggestions to improve your ad:\n${suggestions}\n\n` : ''}${newStatus === 'active' ? '🎉 Your ad is now live on the GamerGain Ad Grid!\n\n' : newStatus === 'pending' ? '⏳ Our team will manually review your ad within 24 hours.\n\n' : '🔄 You can edit and resubmit your ad after making improvements.\n\n'}Manage your campaigns:\nhttps://gamergain.app/AdBusinessDashboard\n\n— GamerGain Ad Grid`,
    });
  }

  return Response.json({
    success: true,
    ad_id: adId,
    new_status: newStatus,
    ai_score: overall_score,
    brand_safety,
    recommendation,
    rejection_reason: rejection_reason || null,
  });
});