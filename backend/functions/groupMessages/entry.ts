import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember } from "../../sdk/group.ts";
import { translateChat } from "../../sdk/chat-i18n.ts";

// groupMessages (authenticated) — recent group chat. Membership-only. Read-only.
//   Body: { session_id, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit) || 60));

    const session = await db.get("GroupSession", sessionId).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Not found" }, { status: 404 });
    if (!isMember(session, user.id)) return Response.json({ error: "Not your group." }, { status: 403 });

    const rows = await db.filter("GroupMessage", { session_id: sessionId }, "-created_date", limit).catch(() => []) as Record<string, unknown>[];
    let messages = (rows || []).filter((m) => !m.flagged).map((m) => ({
      id: m.id, from_me: m.from_user_id === user.id, from_name: m.from_name || "Member", kind: m.kind, text: String(m.text || ""), original: String(m.text || ""), at: m.created_date,
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
