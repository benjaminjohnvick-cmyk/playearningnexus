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
    const { prospect_id, outreach_type = 'email' } = body;

    // Fetch prospect details
    const prospect = await base44.entities.CRMProspect.get(prospect_id);
    
    if (!prospect) {
      return Response.json({ error: 'Prospect not found' }, { status: 404 });
    }

    // Generate personalized email using AI
    const emailResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a personalized, compelling ${outreach_type} message for:
      Company: ${prospect.company_name}
      Industry: ${prospect.industry}
      Contact: ${prospect.contact_name}
      Key insight: ${prospect.ai_insights}
      
      The message should:
      - Be professional but warm
      - Highlight how our research/survey platform can help their industry
      - Reference their company's potential pain points
      - Include a clear CTA
      - Be personalized to their industry
      
      Format response as JSON with fields: subject_line, email_body, next_action_suggestion`,
      response_json_schema: {
        type: "object",
        properties: {
          subject_line: { type: "string" },
          email_body: { type: "string" },
          next_action_suggestion: { type: "string" }
        }
      }
    });

    // Create outreach record
    const outreach = await base44.entities.CRMOutreach.create({
      prospect_id: prospect_id,
      outreach_type: outreach_type,
      subject_line: emailResponse.subject_line,
      email_body: emailResponse.email_body,
      ai_generated: true,
      sent_by: user.id,
      next_action: emailResponse.next_action_suggestion,
      sent_date: new Date().toISOString()
    });

    // Update prospect status
    await base44.entities.CRMProspect.update(prospect_id, {
      status: 'contacted'
    });

    // Update conversion tracking
    const conversions = await base44.entities.CRMLeadConversion.filter({ prospect_id: prospect_id });
    if (conversions.length > 0) {
      await base44.entities.CRMLeadConversion.update(conversions[0].id, {
        outreach_count: (conversions[0].outreach_count || 0) + 1,
        last_interaction_date: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      outreach: outreach,
      message: `Personalized ${outreach_type} generated for ${prospect.company_name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});