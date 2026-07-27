// Internal-vs-external call guard.
//
// Functions invoked in-process via base44.functions.invoke() are dispatched to the host
// "internal" (see sdk/mod.ts). Public HTTP callers arrive at the real domain. Money-minting /
// credit-granting functions that are meant to be called only by other server functions,
// schedulers, or admins can use these helpers to reject arbitrary public callers without
// breaking legitimate internal invocation.
import { createClientFromRequest } from "./mod.ts";

/** True when this request came from an in-process function.invoke (host "internal"). */
export function isInternalCall(req: Request): boolean {
  try { return new URL(req.url).hostname === "internal"; } catch { return false; }
}

/** Allow only internal invocations or an authenticated admin. Returns a 403 Response to hand back,
 *  or null when the caller is allowed to proceed. */
export async function requireInternalOrAdmin(req: Request): Promise<Response | null> {
  if (isInternalCall(req)) return null;
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (user?.role === "admin") return null;
  return Response.json({ error: "Forbidden — internal or admin invocation only." }, { status: 403 });
}
