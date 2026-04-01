import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { survey_id } = body;

    // Get survey
    const survey = await base44.entities.DailyAISurvey.get(survey_id);
    if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });

    // Find product with highest interest (lowest avg rank)
    const winningProduct = survey.products.reduce((prev, current) => 
      (current.votes > prev.votes) ? current : prev
    );

    // AI-generated price (between $4.99 - $49.99)
    const aiPrice = Math.round((Math.random() * 45 + 4.99) * 100) / 100;

    // Create product
    const newProduct = await base44.entities.Product.create({
      name: winningProduct.product_name,
      description: winningProduct.description,
      price: aiPrice,
      category: 'ai_generated',
      status: 'active',
      created_from_survey: survey_id
    });

    // Update survey
    await base44.entities.DailyAISurvey.update(survey_id, {
      winning_product: winningProduct.product_name,
      status: 'published',
      created_product_id: newProduct.id,
      created_product_price: aiPrice,
      published_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      product_id: newProduct.id,
      product_name: winningProduct.product_name,
      price: aiPrice,
      message: 'Product auto-created and published'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});