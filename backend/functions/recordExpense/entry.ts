import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { recordExpense as record } from "../../sdk/expenses.ts";

// recordExpense (INTERNAL/ADMIN) — log a real business expense so the growth-budget engine can account for
// it (marketing spend drives CAC; all expenses reduce free surplus). Body:
//   { amount_usd, category?: "marketing"|"infra"|"ai"|"ops"|"other", note?, at? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount_usd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "amount_usd (positive number) required" }, { status: 400 });
    }
    const id = await record({ amount_usd: amount, category: body.category, note: body.note, at: body.at });
    if (!id) return Response.json({ error: "Could not record expense" }, { status: 500 });
    return Response.json({ success: true, id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
