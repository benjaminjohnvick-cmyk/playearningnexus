import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, price, images, platform, genre_tags, download_url, version, category_fields } = body;

    if (!title || !description || !category || price === undefined) {
      return Response.json({ error: 'Missing required fields: title, description, category, price' }, { status: 400 });
    }

    // Create PendingProduct record
    const pending = await base44.asServiceRole.entities.PendingProduct.create({
      title,
      description,
      category,
      price: parseFloat(price),
      images: images || [],
      seller_id: user.id,
      seller_email: user.email,
      platform: platform || [],
      genre_tags: genre_tags || [],
      download_url: download_url || '',
      version: version || '1.0',
      category_fields: category_fields || {},
      ai_review_status: 'pending',
      submitted_at: new Date().toISOString()
    });

    // Send confirmation email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Product Submitted: ${title}`,
      body: `Your product "${title}" has been submitted for review. You will be notified once the AI review is complete.\n\nSubmission ID: ${pending.id}`
    });

    return Response.json({
      success: true,
      pending_product_id: pending.id,
      message: 'Product submitted for AI review. You will be notified of the outcome.'
    });
  } catch (error) {
    console.error('Submit product error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});