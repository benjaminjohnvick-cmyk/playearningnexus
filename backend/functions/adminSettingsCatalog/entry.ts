import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { effectiveSettings, categories } from "../../sdk/settings.ts";

// adminSettingsCatalog (ADMIN) — returns every adjustable setting with its current EFFECTIVE value
// and where that value came from (db override / env / default), grouped for the admin panel.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const settings = await effectiveSettings();
    return Response.json({ categories: categories(), settings });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
