import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { content, target_language } = body;

    const languageMap = {
      'africa': 'Swahili',
      'middle_east': 'Arabic',
      'china': 'Mandarin Chinese',
      'india': 'Hindi',
      'bangladesh': 'Bengali',
      'russia': 'Russian',
      'mexico': 'Spanish',
      'indonesia': 'Indonesian',
      'pakistan': 'Urdu',
      'nigeria': 'Yoruba',
      'brazil': 'Portuguese',
      'ethiopia': 'Amharic'
    };

    // Use LLM to translate
    const translationResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Translate the following content to ${languageMap[target_language] || target_language}:\n\n${content}`,
      model: 'automatic'
    });

    return Response.json({
      success: true,
      target_language: target_language,
      target_language_name: languageMap[target_language],
      translated_content: translationResult
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});