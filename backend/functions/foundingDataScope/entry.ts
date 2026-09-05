import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { buildFoundingDataScope, foundingDataEnabled } from "../../sdk/founding-data.ts";
import { snapNumber } from "../../sdk/settings.ts";

// foundingDataScope — admin READ of the founding-panel data footprint: the first-party category manifest and,
// per category, how many signals + distinct users were collected in the window. Proves exactly what is (and
// isn't) collected — first-party, disclosed categories only, no third-party sharing.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!foundingDataEnabled()) return Response.json({ ok: true, enabled: false, note: "Founding data collection is OFF." });
    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(2, Number(body.window_days) || snapNumber("PMF_WINDOW_DAYS", 30));
    const scope = await buildFoundingDataScope(windowDays);
    return Response.json({ ok: true, ...scope });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
