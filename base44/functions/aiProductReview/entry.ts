import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    // Called from entity automation: payload has event + data
    const pendingProductId = body?.event?.entity_id || body?.pending_product_id;

    if (!pendingProductId) {
      return Response.json({ error: 'Missing pending_product_id' }, { status: 400 });
    }

    // Fetch the pending product
    const records = await base44.asServiceRole.entities.PendingProduct.filter({ id: pendingProductId });
    const pending = records[0];

    if (!pending) {
      return Response.json({ error: 'PendingProduct not found' }, { status: 404 });
    }

    // Mark as reviewing
    await base44.asServiceRole.entities.PendingProduct.update(pendingProductId, {
      ai_review_status: 'reviewing'
    });

    // Run AI review
    const reviewPrompt = `You are a product compliance reviewer for a gaming and digital marketplace platform.

Review the following product submission and determine if it complies with store policies:

Title: ${pending.title}
Description: ${pending.description}
Category: ${pending.category}
Price: $${pending.price}
Platform: ${(pending.platform || []).join(', ')}
Genre Tags: ${(pending.genre_tags || []).join(', ')}
Version: ${pending.version || 'N/A'}
Category-specific fields: ${JSON.stringify(pending.category_fields || {})}

Store policies:
1. No adult-only, illegal, or harmful content
2. Product must have a clear description of at least 20 words
3. Price must be reasonable (between $0 and $999)
4. Title must be descriptive and professional
5. Category must match the actual product type
6. No spam, duplicate, or misleading products

Provide your review as JSON with:
- approved (boolean): whether to approve
- compliance_score (number 0-100): overall compliance score
- feedback (string): detailed feedback for the seller
- rejection_reason (string or null): specific reason if rejected`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: reviewPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          approved: { type: 'boolean' },
          compliance_score: { type: 'number' },
          feedback: { type: 'string' },
          rejection_reason: { type: 'string' }
        }
      }
    });

    const approved = aiResult.approved === true;
    const now = new Date().toISOString();

    // Update PendingProduct with AI result
    await base44.asServiceRole.entities.PendingProduct.update(pendingProductId, {
      ai_review_status: approved ? 'approved' : 'rejected',
      ai_review_feedback: aiResult.feedback,
      ai_compliance_score: aiResult.compliance_score,
      ai_reviewed_at: now,
      rejection_reason: aiResult.rejection_reason || null
    });

    let publishedId = null;

    if (approved) {
      // Auto-publish to Game entity
      const published = await base44.asServiceRole.entities.Game.create({
        title: pending.title,
        description: pending.description,
        category: pending.category,
        price: pending.price,
        icon_url: (pending.images || [])[0] || '',
        screenshots: pending.images || [],
        platform: pending.platform || [],
        developer_id: pending.seller_id,
        status: 'approved',
        marketplace_approved: true,
        submission_date: now.split('T')[0]
      });

      publishedId = published.id;

      await base44.asServiceRole.entities.PendingProduct.update(pendingProductId, {
        published_product_id: publishedId
      });
    }

    // Notify seller
    if (pending.seller_email) {
      const subject = approved ? `✅ Product Approved: ${pending.title}` : `❌ Product Rejected: ${pending.title}`;
      const body = approved
        ? `Great news! Your product "${pending.title}" has been approved and is now live in the store.\n\nCompliance Score: ${aiResult.compliance_score}/100\nFeedback: ${aiResult.feedback}`
        : `Your product "${pending.title}" was not approved.\n\nReason: ${aiResult.rejection_reason}\nFeedback: ${aiResult.feedback}\n\nYou may revise and resubmit.`;

      await base44.integrations.Core.SendEmail({
        to: pending.seller_email,
        subject,
        body
      });
    }

    return Response.json({
      success: true,
      approved,
      compliance_score: aiResult.compliance_score,
      feedback: aiResult.feedback,
      published_product_id: publishedId
    });
  } catch (error) {
    console.error('AI review error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});