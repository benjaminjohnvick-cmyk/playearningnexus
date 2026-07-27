import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getDef, setSetting } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";

// adminSettingsUpdate (ADMIN) — set one or more settings. Each change is validated against the
// registry, written to GlobalSettings (DB override wins over env), and recorded in AdminAuditLog.
//   Body: { updates: [{ key, value }, ...] }  OR  { key, value }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const updates: Array<{ key: string; value: unknown }> = Array.isArray(body.updates)
      ? body.updates
      : (body.key !== undefined ? [{ key: body.key, value: body.value }] : []);
    if (!updates.length) return Response.json({ error: "Provide { updates: [{key,value}] } or { key, value }." }, { status: 400 });

    const applied: Array<{ key: string; from: string; to: string }> = [];
    const errors: Array<{ key: string; error: string }> = [];

    for (const u of updates) {
      const def = getDef(String(u.key));
      if (!def) { errors.push({ key: String(u.key), error: "Unknown setting" }); continue; }
      try {
        const res = await setSetting(def.key, u.value, user.id);
        if (res.from !== res.to) {
          applied.push(res);
          await db.create("AdminAuditLog", {
            actor_email: user.email, actor_id: user.id,
            action_type: "setting_update", target: res.key,
            details: { from: res.from, to: res.to, category: def.category, sensitive: !!def.sensitive },
            timestamp: new Date().toISOString(),
          }, user.id).catch(() => null);
        }
      } catch (e) {
        errors.push({ key: def.key, error: (e as Error).message });
      }
    }

    return Response.json({ success: errors.length === 0, applied, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
