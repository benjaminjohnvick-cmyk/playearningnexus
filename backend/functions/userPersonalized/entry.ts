import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { compileProfile } from "../../sdk/user-profile.ts";
import { buildSiteContext } from "../../sdk/site-model.ts";
import { Core } from "../../sdk/integrations.ts";

// userPersonalized (authenticated user) — called on each visit. Compiles the user's AI profile and
// returns custom recommendations + an AI chatbot opener tuned to drive engagement and purchases,
// grounded in both the user's profile and the evolving site model.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await compileProfile(base44, user.id);

    // Heuristic fallback recommendations by segment.
    const fallback: Record<string, string[]> = {
      new: ["Complete your first survey to unlock the store", "Claim your welcome bonus"],
      engaged: ["You're close to today's goal — 1 more survey", "Browse the store for a reward"],
      active: ["Keep your streak alive for bonus points", "Refer a friend and earn together"],
      whale: ["Exclusive items just for you in the store", "Unlock premium perks"],
      at_risk: ["We miss you — here's a comeback bonus", "New surveys are waiting"],
    };
    let recommendations = fallback[String(profile.segment)] || fallback.engaged;
    let greeting = `Welcome back${profile.full_name ? ", " + profile.full_name : ""}!`;
    let chatOpener = "Want me to find the fastest way to earn today?";

    if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
      try {
        const site = await buildSiteContext();
        const out = await Core.InvokeLLM({
          prompt:
            `${site}\n\nUser profile: ${JSON.stringify(profile)}.\n` +
            `Write a warm one-line greeting, 3 short personalized recommendations that nudge this user toward ` +
            `engagement and purchases (respectful, not pushy), and a single friendly AI-chatbot opener. ` +
            `Tailor to their segment and balance.`,
          response_json_schema: {
            type: "object",
            properties: { greeting: { type: "string" }, recommendations: { type: "array", items: { type: "string" } }, chat_opener: { type: "string" } },
            required: ["greeting", "recommendations", "chat_opener"],
          },
        }) as any;
        if (out?.greeting) greeting = out.greeting;
        if (Array.isArray(out?.recommendations) && out.recommendations.length) recommendations = out.recommendations.slice(0, 4);
        if (out?.chat_opener) chatOpener = out.chat_opener;
      } catch { /* fall back to heuristic */ }
    }

    return Response.json({ profile, greeting, recommendations, chat_opener: chatOpener });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
