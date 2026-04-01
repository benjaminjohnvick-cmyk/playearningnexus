import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Generate today's survey with AI
    const today = new Date().toISOString().split('T')[0];
    
    // Sample products - in production, fetch from Product entity
    const sampleProducts = [
      { name: 'AI Resume Builder', description: 'Auto-create professional resumes' },
      { name: 'Social Media Scheduler', description: 'Plan & post to all platforms' },
      { name: 'Video Editor', description: 'Auto-edit videos with AI' },
      { name: 'Email Marketing Suite', description: 'Design & send campaigns' },
      { name: 'Landing Page Builder', description: 'Create landing pages in minutes' }
    ];

    // Create survey
    const survey = await base44.entities.DailyAISurvey.create({
      survey_date: today,
      products: sampleProducts.map((p, i) => ({
        product_name: p.name,
        description: p.description,
        rank: i + 1,
        votes: 0
      })),
      status: 'voting'
    });

    return Response.json({
      success: true,
      survey_id: survey.id,
      products_count: sampleProducts.length,
      message: 'Daily survey generated'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});