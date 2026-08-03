import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { multiTenancyEnabled, defaultTenantId, raasRevenueSharePct } from "../../sdk/tenant.ts";

// tenantRegistry (ADMIN) — the rewards-as-a-service control plane (flywheel #2). Lists tenant brands running
// on your rails and (POST) registers/updates one. Multi-tenancy is a seam: off by default (you're the only
// tenant), but the registry + resolver are built so onboarding a brand later is config, not a rewrite.
//   GET-style {}                              → { enabled, default_tenant, revenue_share_pct, tenants }
//   { register: { tenant_id, name, ... } }    → upserts a tenant
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.register) {
      const r = body.register as Record<string, unknown>;
      const tid = String(r.tenant_id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!tid) return Response.json({ error: "tenant_id required" }, { status: 400 });
      const existing = (await db.filter("Tenant", { tenant_id: tid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
      const patch = {
        tenant_id: tid,
        name: String(r.name || tid),
        status: String(r.status || "active"),
        revenue_share_pct: Number(r.revenue_share_pct) || raasRevenueSharePct(),
        saas_fee_usd: Number(r.saas_fee_usd) || 0,
        contact: String(r.contact || ""),
      };
      if (existing?.id) await db.update("Tenant", existing.id as string, patch);
      else await db.create("Tenant", { ...patch, created_at: new Date().toISOString() }, user.id);
      return Response.json({ ok: true, tenant_id: tid });
    }

    const tenants = await db.filter("Tenant", {}, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    return Response.json({
      enabled: multiTenancyEnabled(),
      default_tenant: defaultTenantId(),
      revenue_share_pct: raasRevenueSharePct(),
      tenants: (tenants || []).map((t) => ({ tenant_id: t.tenant_id, name: t.name, status: t.status, revenue_share_pct: t.revenue_share_pct, saas_fee_usd: t.saas_fee_usd })),
      note: "Multi-tenancy is the rewards-as-a-service seam. Off by default (single tenant = you). Turn on MULTITENANCY_ENABLED to onboard brands; every tenant-scoped call routes through resolveTenantId().",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
