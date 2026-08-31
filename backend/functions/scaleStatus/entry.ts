import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { effectiveSettings } from "../../sdk/settings.ts";
import { autoScaleEnabled, scaleLeversFromSettings } from "../../sdk/scale-governor.ts";

// scaleStatus — read-only: the auto-scale switch state and each lever's current value vs. its base/scaled
// targets, so the Setup Wizard / ops console can show what's scaled and what would scale next. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const levers = scaleLeversFromSettings();
    const all = await effectiveSettings().catch(() => []) as Array<{ key: string; value: string }>;
    const rows = levers.map((l) => {
      const cur = String(all.find((s) => s.key === l.key)?.value ?? l.base);
      return { key: l.key, label: l.label, metric: l.metric, up: l.up, down: l.down, base: l.base, scaled: l.scaled, current: cur, is_scaled: cur === l.scaled };
    });
    return Response.json({
      ok: true, enabled: autoScaleEnabled(),
      scaled_count: rows.filter((r) => r.is_scaled).length, total: rows.length, levers: rows,
      note: autoScaleEnabled() ? "Auto-scale ON — the governor flips these automatically with load." : "Auto-scale OFF — enable AUTO_SCALE_ENABLED to switch automatically.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
