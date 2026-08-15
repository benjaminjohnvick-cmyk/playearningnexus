import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier1SelfPacedConfig, activeSelfPacedPlan, selfPacedStatus } from "../../sdk/tier1-selfpaced.ts";

// tier1SelfPacedCancel (auth) — pause, resume, or cancel the Self-Paced subscription. Because nothing is
// ever owed, all three are free and instant: no penalty, no balance, no collections. Canceling/pausing just
// stops new impressions; whatever was already paid keeps the service it bought.
//   Body: { action: "cancel" | "pause" | "resume" }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await tier1SelfPacedConfig(jurisdiction);
    const uid = String(user.id);
    const plan = await activeSelfPacedPlan(uid);
    if (!plan?.id) return Response.json({ error: "No self-paced plan to update." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "cancel");
    const map: Record<string, string> = { cancel: "canceled", pause: "paused", resume: "active" };
    const next = map[action];
    if (!next) return Response.json({ error: "action must be cancel, pause, or resume." }, { status: 400 });
    if (next === "paused" && !cfg.allowPause) return Response.json({ error: "Pausing is disabled; you can cancel instead (still no balance owed)." }, { status: 400 });

    const fields = { status: next, status_changed_at: new Date().toISOString() };
    await db.update("Tier1SelfPacedPlan", String(plan.id), fields, uid);
    const status = selfPacedStatus({ ...plan, ...fields }, cfg);
    return Response.json({
      success: true,
      status,
      note: next === "canceled"
        ? "Canceled. You owe nothing. Everything you already paid keeps the service it bought; restart anytime."
        : next === "paused"
          ? "Paused. Nothing is owed while paused — resume and pay whenever you like."
          : "Resumed. Pay whatever you like, whenever you like.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
