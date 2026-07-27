import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// moneyLedgerView (Master Plan 0.4) — ADMIN view of the immutable money-movement audit log.
//   body: { user_id?, type?, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const q: Record<string, unknown> = {};
    if (body.user_id) q.user_id = body.user_id;
    if (body.type) q.type = body.type;
    const entries = await db.filter("MoneyLedgerEntry", q, "-created_date", Number(body.limit ?? 200));
    return Response.json({ count: (entries || []).length, entries });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
