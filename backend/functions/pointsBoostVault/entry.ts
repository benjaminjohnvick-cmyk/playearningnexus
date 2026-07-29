import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setVault, boostStatus } from "../../sdk/points-boost.ts";

// pointsBoostVault (authenticated) — lock/unlock points into the Vault for a higher Boost. Locking is a
// reversible flag (no real lock-up), and vaulted points stay closed-loop (never cashable). Encourages
// holding, which is breakage-friendly and cheaper for the platform.
// Body: { lock: boolean, points?: number }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const r = await setVault(user.id, !!body?.lock, body?.points);
    const status = await boostStatus(user.id);
    return Response.json({ ok: true, ...r, message: r.locked ? "Vault locked — your Boost just went up." : "Vault unlocked.", ...status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
