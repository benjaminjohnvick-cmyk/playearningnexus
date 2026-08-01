import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { chatRetentionDays } from "../../sdk/group.ts";

// chatTranscriptExport (INTERNAL/ADMIN ONLY) — compile a buddy or group conversation into a plain-text
// transcript for SAFETY / MODERATION review. This is a moderator tool: users can NEVER pull each other's
// chats. Messages are retained for CHAT_TRANSCRIPT_RETENTION_DAYS (disclose in the privacy policy).
//   Body: { kind: "group"|"buddy", id }  → { transcript, count, retention_days }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "buddy" ? "buddy" : "group";
    const id = String(body.id || "");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const entity = kind === "buddy" ? "BuddyMessage" : "GroupMessage";
    const key = kind === "buddy" ? "pair_id" : "session_id";
    const rows = await db.filter(entity, { [key]: id }, "created_date", 5000).catch(() => []) as Record<string, unknown>[];

    const lines = (rows || []).map((m) => {
      const who = m.from_name || m.from_user_id || "user";
      const flag = m.flagged ? " [FLAGGED]" : "";
      return `[${m.created_date}] ${who}${flag}: ${m.text}`;
    });
    const transcript = `Transcript — ${kind} ${id}\nMessages: ${lines.length}\n\n${lines.join("\n")}\n`;

    return Response.json({ transcript, count: lines.length, retention_days: chatRetentionDays() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
