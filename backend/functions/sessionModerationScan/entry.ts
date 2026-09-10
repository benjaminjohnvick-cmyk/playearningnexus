import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { moderateText } from "../../sdk/rules-first.ts";
import { modelForJob } from "../../sdk/ai-models.ts";
import {
  aiModerationEnabled, killOnBlock, visionModerationEnabled, verdictFromAi, hostModerationPrompt,
  recordModEvent, type HostModVerdict,
} from "../../sdk/host-moderation.ts";

// sessionModerationScan — the AI moderation LAYER for a live session's content. Rules-first (free) handles the
// clearly-fine and clearly-bad; only the ambiguous middle reaches the cheap Llama tier. On a BLOCK it kills the
// stream (ends the session) and records a repeat-infringer STRIKE against the host, which feeds the DMCA
// repeat-infringer termination policy. Text/title/product/message scan works now; frame (vision) scanning is a
// safe no-op until a vision model is configured. Complements — never replaces — the registered DMCA agent.
//   POST { room, kind:"title"|"product"|"message"|"frame", text?, image_url? } → { ok, verdict }
export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false });
    if (!aiModerationEnabled()) return Response.json({ ok: true, moderation: false, verdict: { action: "allow", via: "skipped" } });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const room = String(b.room || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    const kind = String(b.kind || "message");
    const text = String(b.text || "").slice(0, 1000);
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    const sess = (await base44.asServiceRole.entities.GameSession.filter({ session_id: room }).catch(() => []))[0];
    const hostId = String(sess?.host_player_id ?? "");

    let verdict: HostModVerdict = { action: "allow", categories: [], severity: null, reason: null, via: "skipped" };

    if (kind === "frame") {
      // Vision moderation is a safe no-op until a vision model + image pipeline are configured.
      if (!visionModerationEnabled()) return Response.json({ ok: true, verdict: { action: "allow", via: "skipped", note: "vision moderation not configured" } });
      // Placeholder for a configured vision model: without one, do not block.
      verdict = { action: "allow", categories: [], severity: null, reason: null, via: "skipped" };
    } else {
      // RULES FIRST (free): clearly-fine passes, clearly-bad blocks — no AI call.
      const pre = moderateText(text);
      if (pre.decision === "allow") {
        verdict = { action: "allow", categories: [], severity: null, reason: null, via: "rules" };
      } else if (pre.decision === "block") {
        verdict = { action: "block", categories: pre.matched, severity: pre.severity, reason: pre.reason, via: "rules" };
      } else {
        // Ambiguous middle → cheap Llama tier.
        const r = await base44.integrations.Core.InvokeLLM({
          model: modelForJob("routine"),
          prompt: hostModerationPrompt(text, kind),
          response_json_schema: {
            type: "object",
            properties: {
              is_flagged: { type: "boolean" },
              categories: { type: "array", items: { type: "string" } },
              severity: { type: "string" },
              reason: { type: "string" },
            },
          },
        }).catch(() => ({ is_flagged: false }));
        verdict = verdictFromAi(r);
      }
    }

    // Enforce a block: kill the stream + strike the host (feeds the repeat-infringer policy).
    if (verdict.action === "block") {
      if (killOnBlock() && sess?.id) {
        await base44.asServiceRole.entities.GameSession.update(sess.id, {
          status: "ended", moderation_status: "blocked", block_reason: verdict.reason ?? "policy violation", hls_url: "",
        }).catch(() => null);
      }
      await recordModEvent({
        session_id: room, host_player_id: hostId, type: "block", action: "block",
        categories: verdict.categories, severity: verdict.severity, reason: verdict.reason,
        actor: user.email ?? String(user.id), strike: true,
      });
    } else {
      await recordModEvent({ session_id: room, host_player_id: hostId, type: "scan", action: verdict.action, categories: verdict.categories, severity: verdict.severity, reason: verdict.reason, actor: user.email ?? String(user.id) });
    }

    return Response.json({ ok: true, room, verdict });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
