import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { compileProfile } from "../../sdk/user-profile.ts";
import { buildSiteContext } from "../../sdk/site-model.ts";
import { Core } from "../../sdk/integrations.ts";

// userAssistantChat (authenticated user) — back-and-forth AI assistant. Grounded in the user's
// compiled profile + the evolving site model, it answers questions and nudges the user toward
// engagement and purchases (respectfully). Body: { message, history?: [{role,content}] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const raw = await req.json().catch(() => ({}));
    if (!raw.message || typeof raw.message !== "string") return Response.json({ error: "message required" }, { status: 400 });
    // Bound inputs so a caller can't inflate token cost.
    const message = raw.message.slice(0, 2000);
    const history = Array.isArray(raw.history)
      ? raw.history.slice(-8).map((m: any) => ({ role: m?.role, content: String(m?.content ?? "").slice(0, 2000) }))
      : [];

    if (!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"))) {
      return Response.json({ reply: "I'm here to help you earn more and enjoy GamerGain! Try completing a survey to reach today's goal, or check the store for a reward." });
    }

    const [profile, site] = await Promise.all([
      compileProfile(base44, user.id).catch(() => ({})),
      buildSiteContext().catch(() => ""),
    ]);
    const convo = Array.isArray(history)
      ? history.slice(-8).map((m: any) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n")
      : "";

    const reply = await Core.InvokeLLM({
      prompt:
        `You are GamerGain's friendly in-app assistant. Be concise, warm, and genuinely helpful. Help the ` +
        `user earn, play, and get value; where natural, encourage engagement and purchases — never pushy, ` +
        `never misleading, no guaranteed-earnings claims.\n\n${site}\n\nUser profile: ${JSON.stringify(profile)}\n\n` +
        `${convo ? "Conversation so far:\n" + convo + "\n\n" : ""}User: ${message}\nAssistant:`,
    }) as string;

    return Response.json({ reply: typeof reply === "string" ? reply : "Happy to help — what would you like to do next?" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
