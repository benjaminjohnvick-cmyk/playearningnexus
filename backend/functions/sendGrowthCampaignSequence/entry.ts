import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get active campaigns
    const campaigns = await base44.asServiceRole.entities.AffiliateGrowthCampaign.filter(
      { status: 'active' },
      '',
      1000
    );

    let emailsSent = 0;
    let postPublished = 0;

    for (const campaign of campaigns) {
      const daysSinceStart = Math.floor(
        (new Date() - new Date(campaign.enrolled_date)) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceStart > 30) {
        // Campaign complete
        await base44.asServiceRole.entities.AffiliateGrowthCampaign.update(campaign.id, {
          status: 'completed'
        });
        continue;
      }

      // Send email for current day
      const emailForToday = campaign.email_sequence?.find(e => e.day === daysSinceStart + 1);
      if (emailForToday && !emailForToday.sent) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: campaign.affiliate_email,
          subject: emailForToday.email_subject,
          body: emailForToday.email_body
        });

        // Update email status
        const updatedSequence = campaign.email_sequence.map(e =>
          e.day === emailForToday.day
            ? { ...e, sent: true, sent_date: new Date().toISOString() }
            : e
        );

        await base44.asServiceRole.entities.AffiliateGrowthCampaign.update(campaign.id, {
          email_sequence: updatedSequence,
          emails_sent: (campaign.emails_sent || 0) + 1
        });

        emailsSent++;
      }

      // Publish social media post for current day
      const postForToday = campaign.social_media_sequence?.find(p => p.day === daysSinceStart + 1);
      if (postForToday && !postForToday.posted) {
        // Use existing autoPostContentToSocial if available, or call InvokeLLM for posting
        try {
          await base44.asServiceRole.functions.invoke('autoPostContentToSocial', {
            content: postForToday.post_content,
            platform: postForToday.platform,
            hashtags: ['affiliate', 'growth', 'makemoney']
          });

          const updatedSocial = campaign.social_media_sequence.map(p =>
            p.day === postForToday.day
              ? { ...p, posted: true, posted_date: new Date().toISOString() }
              : p
          );

          await base44.asServiceRole.entities.AffiliateGrowthCampaign.update(campaign.id, {
            social_media_sequence: updatedSocial,
            posts_published: (campaign.posts_published || 0) + 1
          });

          postPublished++;
        } catch (err) {
          // Log but don't fail if post fails
          console.error('Failed to post social media:', err.message);
        }
      }
    }

    return Response.json({
      status: 'success',
      campaigns_active: campaigns.length,
      emails_sent: emailsSent,
      posts_published: postPublished,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});