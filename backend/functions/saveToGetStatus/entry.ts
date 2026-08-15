import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { saveToGetConfig, activeGoals, goalView, saveToGetDisclosures } from "../../sdk/save-to-get.ts";

// saveToGetStatus (read) — the caller's Save-to-Get goals + config + disclosures. Nothing owed anywhere.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await saveToGetConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const goals = (await activeGoals(String(user.id))).map(goalView);
    return Response.json({
      enabled: true,
      max_goals: cfg.maxGoals,
      spendable_usd: Math.round((Number((user as Record<string, unknown>).current_balance) || 0) * 100) / 100,
      goals,
      disclosures: saveToGetDisclosures(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
