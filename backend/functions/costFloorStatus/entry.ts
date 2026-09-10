import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { costFloorReport } from "../../sdk/cost-floor.ts";
import { primeSettings } from "../../sdk/settings.ts";

// costFloorStatus — admin READ of the "everything at the floor" state: whether AI runs entirely on Meta's Llama
// via Groq's free tier (projected LLM spend ≈ $0), and the effective LiveKit hosting cost caps (bitrate,
// resolution, framerate, viewers/room, live-hours/day) that hold live-video egress — the only cost that scales —
// to the minimum. Read-only; every value is changed via settings. Live hosting itself stays counsel-gated
// (SESSION_HOSTING_ENABLED off); these caps only make it cheap the moment it is cleared. See
// LIVEKIT-HOSTING-COST-MODEL.md and COST-FLOOR-AND-LLAMA-ROUTING.md.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    await primeSettings().catch(() => {});
    return Response.json({ ok: true, ...costFloorReport() });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
