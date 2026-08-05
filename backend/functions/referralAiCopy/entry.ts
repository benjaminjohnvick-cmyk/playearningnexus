import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { referralLinkFor, contactInviteEnabled } from "../../sdk/referral-invite.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";

// referralAiCopy (authenticated) — generate a ready-to-post referral message TAILORED to the platform the
// user picked (tone, length, hashtags, emoji). The user copies it and pastes it themselves — the platform
// never posts on their behalf. One call per platform tap = minimal clicks.
//   { platform } → { platform, text, link }
//
// PLATFORM_SPECS drives the AI so each platform reads native. An honest material-connection disclosure is
// appended (FTC endorsement guides) since referrers may earn a reward.
const PLATFORM_SPECS: Record<string, { label: string; guide: string; limit: number }> = {
  facebook:  { label: "Facebook",  guide: "warm, personal, 2–3 sentences, 1 emoji, conversational (a post to friends)", limit: 500 },
  instagram: { label: "Instagram", guide: "upbeat caption, a few relevant hashtags, 1–2 emojis, punchy", limit: 300 },
  x:         { label: "X (Twitter)", guide: "witty hook, under 240 characters INCLUDING the link, 1–2 hashtags", limit: 240 },
  tiktok:    { label: "TikTok",    guide: "Gen-Z energy, short hook, casual, 2–3 hashtags", limit: 200 },
  whatsapp:  { label: "WhatsApp",  guide: "friendly one-to-one text, casual, 1 emoji", limit: 400 },
  telegram:  { label: "Telegram",  guide: "friendly, concise, 1 emoji", limit: 400 },
  reddit:    { label: "Reddit",    guide: "plain, no hype, no emoji, honest and specific (Redditors dislike ads)", limit: 500 },
  linkedin:  { label: "LinkedIn",  guide: "professional, concise, no more than 1 emoji, value-focused", limit: 500 },
  email:     { label: "Email",     guide: "short friendly note, greeting + 2 sentences + the link", limit: 600 },
  sms:       { label: "Text",      guide: "very short, casual, like texting a friend, 1 emoji max", limit: 240 },
};

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!contactInviteEnabled()) return Response.json({ error: "Invites aren't enabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const key = String(body.platform || "").toLowerCase();
    const spec = PLATFORM_SPECS[key];
    if (!spec) return Response.json({ error: "Unknown platform.", platforms: Object.keys(PLATFORM_SPECS) }, { status: 400 });

    const link = referralLinkFor(user.id);
    const firstName = String(user.full_name || "").split(" ")[0] || "";
    const nameClause = firstName ? ("their name is " + firstName) : "no name";

    const prompt =
      "Write ONE ready-to-post referral message for a person inviting friends to GamerGain — an app where you " +
      "earn rewards for playing games and doing surveys in your spare time. Platform: " + spec.label + ". " +
      "Style: " + spec.guide + ". Keep it UNDER " + spec.limit + " characters total. Write in the FIRST PERSON " +
      "as the user (" + nameClause + ") sharing with people they know — friendly and genuine, NOT a corporate " +
      "ad. Include this exact link once: " + link + " . Do NOT invent earnings figures or promise any amount. " +
      "Return ONLY the message text, no quotes, no preamble.";

    let text = "";
    try {
      const out = await base44.asServiceRole.integrations.Core.InvokeLLM({ model: "gpt_5_mini", prompt });
      text = String(out || "").trim().replace(/^["']|["']$/g, "");
    } catch { /* fall through to a safe default */ }

    if (!text) {
      // Deterministic fallback if the model is unavailable.
      text = "I've been using GamerGain to earn rewards in my spare time — thought you'd like it. Join with my link: " + link;
    }
    if (!text.includes(link)) text = text + " " + link;

    // Honest material-connection disclosure (referrers may earn a reward). Configurable.
    if (snapBool("REFERRAL_AI_DISCLOSURE_ENABLED", true)) {
      const disc = snapString("REFERRAL_AI_DISCLOSURE", "(Heads up — I may earn a reward if you join.)");
      if (disc && !text.includes(disc)) text = text + "\n" + disc;
    }

    return Response.json({ platform: key, label: spec.label, text, link });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
