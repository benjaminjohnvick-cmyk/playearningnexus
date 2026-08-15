import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { earningsSetAsideConfig, setAsideStatus, SPENDABLE_FIELD, SETASIDE_FIELD } from "../../sdk/earnings-setaside.ts";

// earningsSetAsideMoveNow (auth) — the user voluntarily moves a chosen amount of their CURRENT spendable
// Site Cash into their set-aside bucket right now. Just re-buckets their own money; nothing owed, reversible.
//   Body: { amount_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await earningsSetAsideConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ error: "Set-aside is not available." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const amount = Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    if (amount <= 0) return Response.json({ error: "Enter an amount greater than $0." }, { status: 400 });

    const uid = String(user.id);
    // Debit spendable first (fails cleanly if insufficient), then credit the set-aside bucket.
    const debited = await adjustUserBalance(uid, -amount, { field: SPENDABLE_FIELD });
    if (debited === null) return Response.json({ error: "Not enough spendable Site Cash for that amount." }, { status: 400 });
    await adjustUserBalance(uid, amount, { field: SETASIDE_FIELD });

    const updated = await db.get("User", uid).catch(() => null);
    return Response.json({
      success: true,
      status: setAsideStatus(updated as Record<string, unknown>, cfg),
      note: `Moved $${amount.toLocaleString()} into your set-aside. It's still your Site Cash — move it back anytime.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
