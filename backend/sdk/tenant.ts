// tenant.ts — the multi-tenant / rewards-as-a-service seam (flywheel #2).
//
// Multi-tenancy is IMPOSSIBLE to retrofit once data has piled up, so the seam is built now even though you
// are the only tenant today. Every request resolves to a tenant id; yours is DEFAULT_TENANT_ID. When
// MULTITENANCY_ENABLED is on, other brands run their own rewards/play-to-earn on your rails as separate
// tenants, and you take RAAS_REVENUE_SHARE_PCT of their on-rails volume plus their SaaS fee. See
// SCALE-TO-AMAZON-STRATEGY.md.

import { snapBool, snapString, snapNumber } from "./settings.ts";

export const multiTenancyEnabled = () => snapBool("MULTITENANCY_ENABLED", false);
export const defaultTenantId = () => snapString("DEFAULT_TENANT_ID", "gamergain");
export const raasRevenueSharePct = () => Math.min(1, Math.max(0, snapNumber("RAAS_REVENUE_SHARE_PCT", 0.15)));

/** Resolve the tenant for a request. Single-tenant (default off) → always your own tenant. When enabled,
 *  the tenant comes from an `X-Tenant-Id` header (or a body/query `tenant_id`), falling back to yours. This
 *  is the ONE function every tenant-scoped read/write should route through, so turning tenancy on later is a
 *  config flip, not a rewrite. */
export function resolveTenantId(req?: Request, explicit?: string): string {
  const fallback = defaultTenantId();
  if (!multiTenancyEnabled()) return fallback;
  const fromHeader = req?.headers?.get?.("x-tenant-id") || "";
  const id = String(explicit || fromHeader || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return id || fallback;
}

/** The platform's cut (USD) of a tenant brand's transaction. Your own tenant pays nothing to itself. */
export function raasPlatformFeeUsd(tenantId: string, grossUsd: number): number {
  if (tenantId === defaultTenantId()) return 0;
  return Math.round(Math.max(0, Number(grossUsd) || 0) * raasRevenueSharePct() * 100) / 100;
}
