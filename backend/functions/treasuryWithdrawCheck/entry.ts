import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { withdrawAllowed } from "../../sdk/treasury.ts";

// treasuryWithdrawCheck (ADMIN) — "can I withdraw $X from the business account right now without leaving
// expenses uncovered?" Returns allowed/blocked, the most you can safely take, and why. Read-only; it does not
// move money (PayPal withdrawals happen in PayPal). Use it before pulling funds so you never over-withdraw.
//   body: { amount_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount_usd);
    if (!Number.isFinite(amount) || amount < 0) return Response.json({ error: "amount_usd (>= 0) required" }, { status: 400 });

    const res = await withdrawAllowed(amount);
    return Response.json({ ok: true, ...res });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
