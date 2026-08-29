import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// endorserConversionRecord — the documented HOOK the conversion-attribution flow calls when a member's
// disclosed sponsored post produces a measured conversion. Records a PENDING EndorserConversion; the gated
// endorserRewardSweep computes + credits the Site Cash reward (a share of the conversion value), so nothing
// moves until the program is enabled. Disclosure + self-conversion are captured here and enforced at reward
// time. Idempotent per conversion_ref. Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.member_id ?? "");
    const conversionRef = String(body.conversion_ref ?? "");
    if (!memberId || !conversionRef) return Response.json({ error: "member_id and conversion_ref are required." }, { status: 400 });

    // Idempotency — one row per conversion_ref.
    const existing = await db.filter("EndorserConversion", { conversion_ref: conversionRef }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
    if (existing?.[0]) return Response.json({ ok: true, deduped: true, id: existing[0].id, status: existing[0].status });

    const now = new Date().toISOString();
    const doc = {
      member_id: memberId,
      post_id: body.post_id ? String(body.post_id) : null,
      platform: body.platform ? String(body.platform) : null,
      conversion_ref: conversionRef,
      conversion_value_usd: Math.max(0, Number(body.conversion_value_usd) || 0),
      disclosed: body.disclosed === true,
      self_conversion: body.self_conversion === true,
      status: "pending",
      day: now.slice(0, 10),
      created_at: now, updated_at: now,
    };
    const row = await db.create("EndorserConversion", doc).catch(() => null) as Record<string, unknown> | null;
    return Response.json({ ok: true, id: row?.id ?? null, status: "pending", disclosed: doc.disclosed });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
