import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { allFlags, invalidateFlagCache, KNOWN_FLAGS } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";

// complianceFlags (Master Plan 0.1)
//   • default: return all resolved compliance flags (optionally for a jurisdiction).
//   • { action: "set", name, enabled, disabled_jurisdictions } (ADMIN): override a flag live, no deploy.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.action === "set") {
      if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
      const name = String(body.name ?? "");
      if (!KNOWN_FLAGS.includes(name as never)) {
        return Response.json({ error: `Unknown flag: ${name}`, known: KNOWN_FLAGS }, { status: 400 });
      }
      const patch = {
        name,
        enabled: body.enabled === true,
        disabled_jurisdictions: Array.isArray(body.disabled_jurisdictions) ? body.disabled_jurisdictions : [],
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };
      const existing = await db.filter("ComplianceFlag", { name }, "-created_date", 1) as Record<string, unknown>[];
      if ((existing || []).length) await db.update("ComplianceFlag", existing[0].id as string, patch);
      else await db.create("ComplianceFlag", patch, user.id);
      invalidateFlagCache();
      return Response.json({ success: true, flag: patch });
    }

    const jurisdiction = body.jurisdiction ?? null;
    return Response.json({ flags: await allFlags(jurisdiction), jurisdiction, known: KNOWN_FLAGS });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
