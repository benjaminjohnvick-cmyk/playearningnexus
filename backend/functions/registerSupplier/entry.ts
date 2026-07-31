import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";

// registerSupplier (INTERNAL/ADMIN) — connect a dropship/wholesale supplier so the AI can fulfill through it
// automatically. The API key lives in an ENV var (named here); never stored in the DB.
//   Body: { name, api_base, api_key_env, order_path?, wholesale?, active? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const b = await req.json().catch(() => ({}));
    if (!b.name || !b.api_base || !b.api_key_env) return Response.json({ error: "name, api_base, api_key_env required" }, { status: 400 });

    const supplier = await base44.asServiceRole.entities.Supplier.create({
      name: String(b.name).slice(0, 120),
      api_base: String(b.api_base).slice(0, 300),
      api_key_env: String(b.api_key_env).replace(/[^A-Z0-9_]/gi, "").slice(0, 80),
      order_path: b.order_path ? String(b.order_path).slice(0, 120) : "/orders",
      wholesale: b.wholesale === true,
      active: b.active !== false,
      created_at: new Date().toISOString(),
    });
    return Response.json({ success: true, supplier_id: (supplier as any).id, note: `Set the API key in the '${String(b.api_key_env).replace(/[^A-Z0-9_]/gi, "")}' environment variable to activate full-auto fulfillment.` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
