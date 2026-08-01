import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// reportChat (authenticated) — the "Report inappropriate behavior" button. On click we IMMEDIATELY: end the
// reporter's chat, pull + snapshot the full transcript (and any attached files), flag every message for
// review, and open a SupportTicket in customer service. For a 1:1 the pair ends; for a group the reporter
// exits and the group is flagged for review (innocent members aren't punished). Moderators take it from the
// ticket. Users never receive another user's transcript — it goes only to the CS/moderation queue.
//   Body: { kind: "buddy"|"group", id, reason?, category?, reported_user_id? }  → { success, ticket_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "group" ? "group" : "buddy";
    const id = String(body.id || "");
    const reason = String(body.reason || "Inappropriate behavior").slice(0, 500);
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const entity = kind === "buddy" ? "BuddyPair" : "GroupSession";
    const msgEntity = kind === "buddy" ? "BuddyMessage" : "GroupMessage";
    const key = kind === "buddy" ? "pair_id" : "session_id";

    const record = await db.get(entity, id).catch(() => null) as Record<string, unknown> | null;
    if (!record) return Response.json({ error: "Not found" }, { status: 404 });

    // Membership check.
    const isMember = kind === "buddy"
      ? (record.user_a === user.id || record.user_b === user.id)
      : (Array.isArray(record.members) && (record.members as string[]).map(String).includes(user.id));
    if (!isMember) return Response.json({ error: "Not your chat." }, { status: 403 });

    // 1) END the chat immediately.
    if (kind === "buddy") {
      await db.update("BuddyPair", id, { status: "ended", ended_by: user.id, ended_at: new Date().toISOString(), reported: true }).catch(() => null);
    } else {
      const members = (record.members as string[] || []).map(String).filter((m) => m !== user.id);
      await db.update("GroupSession", id, { members, status: "under_review", reported: true }).catch(() => null);
    }

    // 2) Pull + snapshot the transcript, collect any attached files, and FLAG every message.
    const rows = await db.filter(msgEntity, { [key]: id }, "created_date", 5000).catch(() => []) as Record<string, unknown>[];
    const fileIds: string[] = [];
    const lines: string[] = [];
    for (const m of (rows || [])) {
      const who = m.from_name || m.from_user_id || "user";
      lines.push(`[${m.created_date}] ${who}: ${m.text}`);
      if (Array.isArray(m.media_ids)) fileIds.push(...(m.media_ids as string[]).map(String));
      await db.update(msgEntity, m.id as string, { flagged: true }).catch(() => null);   // pulled for review
    }
    const transcript = lines.join("\n");
    const reportedUser = String(body.reported_user_id || (kind === "buddy" ? (record.user_a === user.id ? record.user_b : record.user_a) : "")).slice(0, 64);

    // 3) Open a SupportTicket for customer-service / trust & safety review.
    const desc = [
      `Reporter: ${user.id}`,
      reportedUser ? `Reported user: ${reportedUser}` : "",
      `Chat: ${kind} ${id}`,
      `Reason: ${reason}`,
      fileIds.length ? `Attached files: ${fileIds.join(", ")}` : "Attached files: none (text chat)",
      `Messages: ${lines.length}`,
      "",
      "----- TRANSCRIPT -----",
      transcript.slice(0, 8000),
      transcript.length > 8000 ? "…(truncated — full transcript retained in the message store)" : "",
    ].filter(Boolean).join("\n");

    const ticket = await base44.asServiceRole.entities.SupportTicket.create({
      user_id: user.id,
      category: "trust_safety",
      priority: "high",
      subject: `[REPORT] Inappropriate behavior in ${kind} chat`,
      description: desc,
      status: "open",
      admin_notes: `Auto-filed from in-chat report. ${fileIds.length} file(s), ${lines.length} message(s).`,
      report_kind: kind, report_ref: id, reported_user_id: reportedUser || null, evidence_file_ids: fileIds,
    });

    // 4) Ping moderators.
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" }).catch(() => []);
    for (const a of (admins || []).slice(0, 5)) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: (a as Record<string, unknown>).id, type: "moderation",
        title: "🚨 Chat reported — review needed", message: `A ${kind} chat was reported for inappropriate behavior. Ticket ${ticket.id} is open.`,
      }).catch(() => null);
    }

    return Response.json({ success: true, ticket_id: ticket.id, message: "Reported. The chat has ended and our team will review it." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
