import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch pending content submissions (ads, templates, games)
    const pendingSubmissions = await base44.entities.PendingProduct.filter(
      { status: 'pending_review' },
      '-created_date',
      50
    );

    const vetting = { approved: [], rejected: [], flagged: [] };

    for (const submission of pendingSubmissions.slice(0, 10)) {
      const vettingPrompt = `Quality and compliance check for marketplace submission:
Title: ${submission.title}
Description: ${submission.description}
Type: ${submission.type}

Assess: 1) Brand alignment, 2) Quality standards, 3) Compliance (IP, content policy), 4) Commercial viability, 5) Plagiarism risk.`;

      const vettingResult = await base44.integrations.Core.InvokeLLM({
        prompt: vettingPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            brand_aligned: { type: 'boolean' },
            quality_score: { type: 'number' },
            compliance_pass: { type: 'boolean' },
            viability_score: { type: 'number' },
            plagiarism_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
            recommendation: { type: 'string', enum: ['approve', 'reject', 'request_revision'] }
          }
        }
      });

      if (vettingResult.recommendation === 'approve' && vettingResult.compliance_pass) {
        await base44.entities.PendingProduct.update(submission.id, { status: 'approved' });
        vetting.approved.push(submission.id);
      } else if (vettingResult.recommendation === 'reject') {
        await base44.entities.PendingProduct.update(submission.id, { status: 'rejected' });
        vetting.rejected.push(submission.id);
      } else {
        vetting.flagged.push({ id: submission.id, reason: vettingResult.recommendation });
      }
    }

    return Response.json({
      success: true,
      approved: vetting.approved.length,
      rejected: vetting.rejected.length,
      flagged: vetting.flagged.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});