import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { surveyProviders, providerConfigured } from "../../sdk/survey-providers.ts";

// surveyProviders (authenticated) — the survey networks available to this user, with configured status.
// More enabled+configured networks = more survey supply = more earning hours. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const providers = surveyProviders().map((p) => ({
      key: p.key, label: p.label, kind: p.kind,
      enabled: p.enabled, configured: providerConfigured(p.key),
      ready: p.enabled && providerConfigured(p.key),
    }));

    return Response.json({ providers, ready_count: providers.filter((p) => p.ready).length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
