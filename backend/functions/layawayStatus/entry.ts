import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { listLayaway, cancelLayaway } from "../../sdk/layaway.ts";

// layawayStatus (authenticated) — list the user's layaways (or cancel one, refunding paid points).
// Body: { cancel_id? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body?.cancel_id) {
      const r = await cancelLayaway(user.id, body.cancel_id);
      if ((r as any).error) return Response.json(r, { status: 400 });
      return Response.json(r);
    }
    const layaways = await listLayaway(user.id);
    return Response.json({ ok: true, layaways });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
