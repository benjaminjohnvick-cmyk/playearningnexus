import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordCorrection } from "../../sdk/ai-control.ts";
import { getDef, setSetting } from "../../sdk/settings.ts";
import { COMPLIANCE_DENYLIST } from "../../sdk/optimizer.ts";
import { db } from "../../sdk/db.ts";

// aiCorrectionSubmit (ADMIN) — a human corrects something the AI did and pushes the fix. If it targets a
// safe (non-compliance) setting, the corrected value is applied immediately. Either way the correction is
// recorded and fed back as a learning signal, so the AI learns from the human fix on the next pass.
//   Body: { activity_id?, setting_key?, target?, corrected_value?, note? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { activity_id, setting_key, target, corrected_value, note } = await req.json().catch(() => ({}));
    if (!setting_key && !target) return Response.json({ error: "Provide setting_key or target." }, { status: 400 });

    let from: unknown = null, applied = false;
    if (setting_key) {
      if (COMPLIANCE_DENYLIST.has(String(setting_key))) {
        return Response.json({ error: `"${setting_key}" is a compliance/guardrail setting and can't be auto-changed here.` }, { status: 403 });
      }
      const def = getDef(String(setting_key));
      if (!def) return Response.json({ error: `Unknown setting: ${setting_key}` }, { status: 400 });
      if (corrected_value !== undefined) {
        const res = await setSetting(def.key, corrected_value, user.id);
        from = res.from; applied = true;
        await db.create("AdminAuditLog", { actor_email: user.email, actor_id: user.id, action_type: "ai_correction", target: def.key, details: { from: res.from, to: res.to, note }, timestamp: new Date().toISOString() }, user.id).catch(() => null);
      }
    }

    await recordCorrection({ activity_id, agent: "human", target: target || setting_key, setting_key, from, to: corrected_value, note }, user.id);

    return Response.json({ ok: true, applied, setting_key: setting_key || null });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
