import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordFoundingSignal, foundingDataEnabled, categoryAllowed } from "../../sdk/founding-data.ts";

// foundingSignalRecord — records ONE comprehensive FIRST-PARTY signal for the CURRENT user, into the founding
// data store the AI model learns from. First-party-only + consent gates live inside recordFoundingSignal, so a
// disallowed category or a member without founding/PMF consent is a clean no-op (never an error the UI must
// handle). Best-effort; never blocks the caller.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!foundingDataEnabled()) return Response.json({ ok: true, enabled: false, note: "Founding data collection off." });

    const body = await req.json().catch(() => ({}));
    const category = String(body.category || "").trim();
    if (!category) return Response.json({ error: "category required" }, { status: 400 });
    const allowed = categoryAllowed(category);
    if (!allowed.ok) return Response.json({ ok: true, recorded: false, reason: allowed.reason });

    const u = user as Record<string, unknown>;
    const founding = !!(u.is_founding_advertiser || u.founding || u.is_founder || u.founding_advertiser);

    const res = await recordFoundingSignal({
      user_id: String(u.id ?? ""),
      category,
      key: body.key ? String(body.key) : null,
      value: body.value ?? null,
      founding,
      meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    });
    return Response.json({ ok: true, ...res, category, founding });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
