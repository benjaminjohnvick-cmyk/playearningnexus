import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { survey_id, survey_title, questions, responses_count, question_charts } = await req.json();

  const prompt = `You are a professional survey research analyst. Analyze the following survey data and generate a comprehensive report.

Survey Title: "${survey_title}"
Total Responses: ${responses_count}

Questions and their answer distribution:
${(question_charts || []).map((qc, i) => `
Q${i + 1}: ${qc.question}
${qc.data.map(d => `  - ${d.name}: ${d.value} responses`).join('\n')}
`).join('\n')}

Generate:
1. A concise executive summary (2-3 sentences) of the overall findings
2. Sentiment analysis - estimate overall positive/neutral/negative response sentiment as percentages
3. 3-5 key trends observed from the data
4. 3-5 actionable recommendations based on the findings

Be specific, data-driven, and insightful. If response count is 0, generate projections and best practices instead.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        sentiment: {
          type: "object",
          properties: {
            positive: { type: "string" },
            neutral: { type: "string" },
            negative: { type: "string" }
          }
        },
        trends: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } }
      }
    }
  });

  return Response.json({ success: true, report: result });
});