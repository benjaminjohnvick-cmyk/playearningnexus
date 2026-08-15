import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { earningsSetAsideConfig, setAsideStatus, clampPct, PCT_FIELD } from "../../sdk/earnings-setaside.ts";

// earningsSetAsideSetPct (auth) — the "button" action: the user chooses how much of their FUTURE earnings to
// set aside. 0 turns it off (the default). Accepts 0..1 or 0..100. Stores the preference on the user; it
// takes effect as new earnings are credited. Never moves existing money and never owes anything.
//   Body: { pct }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await earningsSetAsideConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ error: "Set-aside is not available." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const pct = clampPct(Number(body.pct), cfg.maxPct);
    const uid = String(user.id);
    await db.update("User", uid, { [PCT_FIELD]: pct }, uid);
    const updated = await db.get("User", uid).catch(() => ({ ...(user as Record<string, unknown>), [PCT_FIELD]: pct }));
    return Response.json({
      success: true,
      status: setAsideStatus(updated as Record<string, unknown>, cfg),
      note: pct <= 0
        ? "Set-aside turned off. New earnings go entirely to your spendable balance."
        : `From now on, ${Math.round(pct * 100)}% of what you earn is set aside for you — it stays your own Site Cash, and you can change this or move it back anytime.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
