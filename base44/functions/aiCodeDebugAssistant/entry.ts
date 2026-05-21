import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch bug reports
    const bugReports = await base44.entities.BugReport.filter(
      { status: 'open' },
      '-created_date',
      50
    );

    const debugResults = {
      root_causes_identified: [],
      fixes_suggested: [],
      architecture_improvements: []
    };

    for (const bug of bugReports.slice(0, 10)) {
      const debugPrompt = `Debug this system issue:
Title: ${bug.title}
Description: ${bug.description}
Severity: ${bug.severity}
Steps to reproduce: ${bug.reproduction_steps}

Provide: 1) Root cause analysis, 2) Code fix (if applicable), 3) Testing strategy, 4) Architecture improvements to prevent.`;

      const debugAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: debugPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            root_cause: { type: 'string' },
            code_fix: { type: 'string' },
            testing_steps: { type: 'array', items: { type: 'string' } },
            architecture_improvements: { type: 'array', items: { type: 'string' } },
            estimated_fix_hours: { type: 'number' }
          }
        }
      });

      debugResults.root_causes_identified.push({
        bug_id: bug.id,
        root_cause: debugAnalysis.root_cause,
        fix_hours: debugAnalysis.estimated_fix_hours
      });

      if (debugAnalysis.code_fix) {
        debugResults.fixes_suggested.push({
          bug_id: bug.id,
          fix: debugAnalysis.code_fix
        });
      }

      if (debugAnalysis.architecture_improvements.length > 0) {
        debugResults.architecture_improvements.push({
          bug_id: bug.id,
          improvements: debugAnalysis.architecture_improvements
        });
      }
    }

    return Response.json({
      success: true,
      bugs_analyzed: debugResults.root_causes_identified.length,
      fixes_available: debugResults.fixes_suggested.length,
      architecture_suggestions: debugResults.architecture_improvements.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});