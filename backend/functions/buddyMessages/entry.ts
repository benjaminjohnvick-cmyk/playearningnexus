import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { translateChat } from "../../sdk/chat-i18n.ts";

// buddyMessages (authenticated) — recent encouragement messages for the user's buddy pair. Membership-checked
// (only the two buddies can read). Messages are auto-translated into the reader's chat language. Read-only.
//   Body: { pair_id, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit) || 50));

    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair) return Response.json({ error: "Not found" }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });

    const rows = await db.filter("BuddyMessage", { pair_id: pairId }, "-created_date", limit).catch(() => []) as Record<string, unknown>[];
    let messages = (rows || []).filter((m) => !m.flagged).map((m) => ({
      id: m.id, from_me: m.from_user_id === user.id, kind: m.kind, text: String(m.text || ""), original: String(m.text || ""),
      voice_clip_id: m.voice_clip_id || null, at: m.created_date,
    })).reverse();

    // Auto-translate into the reader's chat language (their own messages stay as-is).
    const lang = String((user as Record<string, unknown>).chat_lang || "en").toLowerCase();
    if (lang !== "en") {
      const idx = messages.map((m, i) => (m.from_me ? -1 : i)).filter((i) => i >= 0);
      const translated = await translateChat(base44, idx.map((i) => messages[i].text), lang).catch(() => null);
      if (translated) idx.forEach((i, k) => { messages[i] = { ...messages[i], text: translated[k] }; });
    }

    return Response.json({ messages, chat_lang: lang });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
