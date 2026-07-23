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

    const balance = Number(user.current_balance ?? 0);
    if (balance < amount) return Response.json({ error: "Insufficient balance", required: amount, balance }, { status: 402 });

    const patch: Record<string, unknown> = { current_balance: Math.round((balance - amount) * 100) / 100 };
    if (body.grant_game_id) {
      const lib = Array.isArray(user.game_library) ? user.game_library : [];
      patch.game_library = [...lib, body.grant_game_id];
    }
    await base44.asServiceRole.entities.User.update(user.id, patch);

    await base44.asServiceRole.entities.Transaction.create({
      user_id: user.id, type: "debit", reason, amount, status: "completed", at: new Date().toISOString(),
    });

    return Response.json({ ok: true, spent: amount, new_balance: patch.current_balance });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
