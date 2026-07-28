import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

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

    const balance = Number(user.current_balance ?? 0);
    if (balance < effectiveAmount) return Response.json({ error: "Insufficient balance", required: effectiveAmount, balance }, { status: 402 });

    const patch: Record<string, unknown> = { current_balance: Math.round((balance - effectiveAmount) * 100) / 100 };
    if (boostCovered > 0) patch.app_time_credit_usd = Math.round(((Number(user.app_time_credit_usd) || 0) - boostCovered) * 100) / 100;
    if (body.grant_game_id) {
      const lib = Array.isArray(user.game_library) ? user.game_library : [];
      patch.game_library = [...lib, body.grant_game_id];
    }
    await base44.asServiceRole.entities.User.update(user.id, patch);

    await base44.asServiceRole.entities.Transaction.create({
      user_id: user.id, type: "debit", reason, amount: effectiveAmount, boost_covered_usd: boostCovered || undefined,
      status: "completed", at: new Date().toISOString(),
    });

    return Response.json({ ok: true, spent: effectiveAmount, boost_covered: boostCovered, new_balance: patch.current_balance });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
