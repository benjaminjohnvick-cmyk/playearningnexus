import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { earningsSetAsideConfig, setAsideStatus, SPENDABLE_FIELD, SETASIDE_FIELD } from "../../sdk/earnings-setaside.ts";

// earningsSetAsideRelease (auth) — move money from the set-aside bucket BACK to spendable. Proves the
// "nothing is locked" promise: the user can reclaim any or all of it at any time, no penalty, no balance.
//   Body: { amount_usd?, all? }  — omit amount_usd + all:true to release the whole bucket.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await earningsSetAsideConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ error: "Set-aside is not available." }, { status: 400 });

    const uid = String(user.id);
    const cur = await db.get("User", uid).catch(() => null);
    const bucket = Math.round((Number((cur as Record<string, unknown>)?.[SETASIDE_FIELD]) || 0) * 100) / 100;
    const body = await req.json().catch(() => ({}));
    let amount = body.all ? bucket : Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    if (amount <= 0) return Response.json({ error: "Enter an amount to release (or pass all:true)." }, { status: 400 });
    if (amount > bucket) amount = bucket; // can't release more than is set aside
    if (amount <= 0) return Response.json({ error: "Your set-aside bucket is empty." }, { status: 400 });

    const debited = await adjustUserBalance(uid, -amount, { field: SETASIDE_FIELD, floorZero: true });
    if (debited === null) return Response.json({ error: "Could not release right now — try again." }, { status: 409 });
    await adjustUserBalance(uid, amount, { field: SPENDABLE_FIELD });

    const updated = await db.get("User", uid).catch(() => null);
    return Response.json({
      success: true,
      status: setAsideStatus(updated as Record<string, unknown>, cfg),
      note: `Moved $${amount.toLocaleString()} back to spendable. It was your money the whole time.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
