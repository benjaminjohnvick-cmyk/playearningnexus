import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// Server-authoritative balance DEBIT.
//
// Balance fields are server-only (the client can't write them via /auth/updateMe), so debits
// flow through here. Checks funds server-side, deducts, ledgers to Transaction, and can grant
// an entitlement atomically (e.g. add a purchased game to the user's library).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    const reason = String(body.reason || "spend");
    if (amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });

    // Daily Boost: during an active free-app-time window, in-app purchases are covered (up to the
    // credit cap) so the user pays nothing until the credit/window is used up. Gate on an IAP marker so
    // ordinary debits aren't waived.
    const windowActive = user.free_app_time_until && new Date(user.free_app_time_until).getTime() > Date.now();
    const isIap = body.iap === true || /iap|in.?app/i.test(reason);
    let boostCovered = 0;
    let effectiveAmount = amount;
    if (windowActive && isIap) {
      const credit = Number(user.app_time_credit_usd) || 0;
      boostCovered = Math.min(credit, amount);
      effectiveAmount = Math.round((amount - boostCovered) * 100) / 100;
    }

    // Base patch (non-balance fields).
    const basePatch: Record<string, unknown> = {};
    if (boostCovered > 0) basePatch.app_time_credit_usd = Math.round(((Number(user.app_time_credit_usd) || 0) - boostCovered) * 100) / 100;
    if (body.grant_game_id) {
      const lib = Array.isArray(user.game_library) ? user.game_library : [];
      basePatch.game_library = [...lib, body.grant_game_id];
    }

    // ATOMIC debit (compare-and-set + retry): re-read the balance and only commit if it hasn't changed,
    // so two concurrent debits can't both pass the funds check and double-spend.
    let finalBalance = 0, done = false;
    for (let i = 0; i < 6 && !done; i++) {
      const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
      const bal = Number(fresh.current_balance) || 0;
      if (bal < effectiveAmount) return Response.json({ error: "Insufficient balance", required: effectiveAmount, balance: bal }, { status: 402 });
      finalBalance = Math.round((bal - effectiveAmount) * 100) / 100;
      const ok = await db.updateIf("User", user.id, { ...basePatch, current_balance: finalBalance }, { field: "current_balance", equals: String(bal) }).catch(() => null);
      if (ok) done = true;
    }
    if (!done) return Response.json({ error: "Please retry — balance is being updated." }, { status: 409 });
    const patch = { current_balance: finalBalance };

    await base44.asServiceRole.entities.Transaction.create({
      user_id: user.id, type: "debit", reason, amount: effectiveAmount, boost_covered_usd: boostCovered || undefined,
      status: "completed", at: new Date().toISOString(),
    });

    return Response.json({ ok: true, spent: effectiveAmount, boost_covered: boostCovered, new_balance: patch.current_balance });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
