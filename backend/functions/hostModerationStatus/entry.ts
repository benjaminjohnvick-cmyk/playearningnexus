import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import {
  aiModerationEnabled, reportThreshold, repeatInfringerLimit, visionModerationEnabled,
  hostStrikeCount, isHostBlocked,
} from "../../sdk/host-moderation.ts";

// hostModerationStatus — read the live-hosting moderation posture: whether AI moderation is on, the thresholds,
// a host's repeat-infringer strike count / blocked state, and the registered DMCA agent on file (the layer +
// the legal registration side by side). Admin sees any host; a host sees their own.
//   POST { host_id? } → { ok, moderation, dmca_agent, host }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const b = await req.json().catch(() => ({}));

    const targetId = user.role === "admin" && b.host_id ? String(b.host_id) : String(user.id);
    const strikes = await hostStrikeCount(targetId);
    const blocked = await isHostBlocked(targetId);

    return Response.json({
      ok: true,
      moderation: {
        ai_moderation_enabled: aiModerationEnabled(),
        vision_scanning_enabled: visionModerationEnabled(),
        report_threshold: reportThreshold(),
        repeat_infringer_limit: repeatInfringerLimit(),
        broadcast_requires_moderation: true,
        note: "AI moderation is the moderation LAYER. It complements — never replaces — the registered DMCA agent + notice-and-takedown. The strike count below is what enforces the DMCA repeat-infringer termination policy.",
      },
      dmca_agent: {
        name: snapString("DMCA_AGENT_NAME", ""),
        email: snapString("DMCA_AGENT_EMAIL", ""),
        address: snapString("DMCA_AGENT_ADDRESS", ""),
        registered: !!snapString("DMCA_AGENT_NAME", "") && !!snapString("DMCA_AGENT_EMAIL", ""),
        note: "Register the designated agent with the U.S. Copyright Office (a separate ~$6 filing). This is required for safe harbor and is NOT replaced by AI moderation.",
        takedown_endpoint: "dmcaTakedownRequest",
      },
      host: { host_id: targetId, strikes, blocked, limit: repeatInfringerLimit() },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
