import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { industries = ['saas', 'fintech', 'ecommerce'], company_size = 'medium' } = body;

    // Use InvokeLLM to generate business prospect profiles
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate 5 high-potential business prospects for ${industries.join(', ')} companies with ${company_size} company size. 
      For each prospect, provide: company name, industry, estimated decision maker email (realistic format), key insight about why they'd be a good fit for survey/research platform, LinkedIn URL (realistic format), and a fit score 0-100.
      Format as JSON array with fields: company_name, industry, contact_email, contact_name, website, linkedin_url, ai_insights, ai_fit_score.`,
      response_json_schema: {
        type: "object",
        properties: {
          prospects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company_name: { type: "string" },
                industry: { type: "string" },
                contact_email: { type: "string" },
                contact_name: { type: "string" },
                website: { type: "string" },
                linkedin_url: { type: "string" },
                ai_insights: { type: "string" },
                ai_fit_score: { type: "number" }
              }
            }
          }
        }
      }
    });

    // Map industries to enum values
    const industryMap = {
      'saas': 'saas',
      'fintech': 'fintech',
      'ecommerce': 'ecommerce',
      'healthcare': 'healthcare',
      'media': 'media',
      'logistics': 'logistics',
      'education': 'education',
      'retail': 'retail',
      'manufacturing': 'manufacturing'
    };

    // Create CRMProspect records
    const prospectsToCreate = response.prospects.map(prospect => ({
      company_name: prospect.company_name,
      industry: industryMap[prospect.industry] || 'other',
      contact_email: prospect.contact_email,
      contact_name: prospect.contact_name,
      company_size: company_size,
      ai_fit_score: prospect.ai_fit_score,
      ai_insights: prospect.ai_insights,
      website: prospect.website,
      linkedin_url: prospect.linkedin_url,
      identified_by: user.id,
      status: 'new'
    }));

    // Bulk create prospects
    const created = await base44.entities.CRMProspect.bulkCreate(prospectsToCreate);

    return Response.json({ 
      success: true,
      count: created.length,
      prospects: created
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});