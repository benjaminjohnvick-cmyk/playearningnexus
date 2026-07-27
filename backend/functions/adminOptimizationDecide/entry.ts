import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { getDef, setSetting } from "../../sdk/settings.ts";

// adminOptimizationDecide (ADMIN) — approve or reject a pending AI recommendation (the money/legal-
// sensitive ones the optimizer would not apply on its own). Approving applies the change (clamped by
// coerce to the registry bounds), audit-logs it, and opens an outcome row so the AI measures and
// learns from the admin-approved change just like an auto-applied one.
//   Body: { id, decision: "approve" | "reject", note? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { id, decision, note } = await req.json().catch(() => ({}));
    if (!id || !["approve", "reject"].includes(decision)) {
      return Response.json({ error: 'Provide { id, decision: "approve" | "reject" }.' }, { status: 400 });
    }

    const rec = await db.get("OptimizationRecommendation", String(id));
    if (!rec) return Response.json({ error: "Recommendation not found" }, { status: 404 });
    if (rec.status !== "pending") return Response.json({ error: `Already ${rec.status}` }, { status: 409 });

    const now = new Date().toISOString();
    if (decision === "reject") {
      await db.update("OptimizationRecommendation", String(id), { status: "rejected", decided_by: user.email, decided_at: now, note: note ?? null });
      return Response.json({ success: true, status: "rejected" });
    }

    // Approve → apply the setting (coerce enforces bounds), audit, open an outcome row.
    const def = getDef(String(rec.key));
    if (!def) return Response.json({ error: `Unknown setting ${rec.key}` }, { status: 400 });
    const res = await setSetting(String(rec.key), rec.proposed_value, user.id);
    await db.update("OptimizationRecommendation", String(id), { status: "approved", decided_by: user.email, decided_at: now, note: note ?? null });
    await db.create("AdminAuditLog", {
      actor_email: user.email, actor_id: user.id, action_type: "ai_setting_update_approved", target: String(rec.key),
      details: { from: res.from, to: res.to, rationale: rec.rationale, objective: rec.objective, category: def.category, sensitive: true },
      timestamp: now,
    }, user.id).catch(() => null);
    await db.create("OptimizationOutcome", {
      key: String(rec.key), from_value: Number(res.from), to_value: Number(res.to), primary_metric: rec.objective,
      before_value: Number(rec.objective_value ?? 0), applied_at: now, verdict: "pending",
      recommendation_id: String(id), auto: false,
    }, user.id).catch(() => null);

    return Response.json({ success: true, status: "approved", applied: res });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
