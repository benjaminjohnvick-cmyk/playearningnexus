import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber, snapString } from "../../sdk/settings.ts";

// systemLoadSignal — the tiny, cheap signal the CLIENT polls to know whether to fall back to on-device mode.
// Returns a load state so the app can automatically shift to serving reads/UI/AI from the device (and queue
// non-sensitive writes) when the server is under pressure — and come back online when it recovers. Deliberately
// lightweight (one indexed read) so it stays fast even while the rest of the system is stressed.
//
// HARD RULE surfaced to the client: sensitive/authoritative actions (payout, purchase, balance change,
// KYC) are NEVER available in the on-device fallback — they require the online, server-authoritative path +
// step-up. The client queues everything else and blocks these until state === "normal".
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Admin override for testing/incidents; else derive from the most recent load metric.
    const forced = (snapString("RESILIENT_FORCE_STATE", "") || "").trim().toLowerCase();
    const degradeAt = Math.max(1, snapNumber("RESILIENT_DEGRADE_RPM", 800));
    const overloadAt = Math.max(degradeAt, snapNumber("RESILIENT_OVERLOAD_RPM", 1500));

    let rpm = 0;
    const recent = await db.filter("LiveMetricEvent", { kind: "requests_per_min" }, "-at", 1).catch(() => []) as Record<string, unknown>[];
    if (recent?.[0]) rpm = Math.max(0, Number(recent[0].value) || 0);

    let state: "normal" | "degraded" | "overloaded" =
      forced === "normal" || forced === "degraded" || forced === "overloaded" ? forced as any
      : rpm >= overloadAt ? "overloaded" : rpm >= degradeAt ? "degraded" : "normal";

    if (!snapBool("RESILIENT_MODE_ENABLED", false)) state = "normal";   // feature off → always normal (no fallback)

    return Response.json({
      ok: true, state, rpm,
      // What the client should do:
      read_from_device: state !== "normal",           // serve reads/UI from local cache
      queue_writes: state === "overloaded",            // hold non-sensitive writes for background sync
      sensitive_actions_online_only: true,             // ALWAYS: money/compliance never run in fallback
      retry_after_s: state === "overloaded" ? 30 : state === "degraded" ? 10 : 0,
      note: state === "normal"
        ? "System nominal — run online."
        : `System ${state} — serve reads/AI from the device${state === "overloaded" ? " and queue non-sensitive writes" : ""}. Sensitive actions stay online-only.`,
    });
  } catch (e) {
    // If even this fails, tell the client to assume degraded and use its local cache.
    return Response.json({ ok: true, state: "degraded", read_from_device: true, queue_writes: false, sensitive_actions_online_only: true, retry_after_s: 10, note: "signal unavailable — assume degraded, use local cache" });
  }
});
