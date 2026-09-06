import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { aiDisclosureConfig, buildContentCredentials } from "../../sdk/ai-disclosure.ts";

// aiDisclosureStatus — admin READ of the AI-generated content disclosure layer: whether the visible
// "AI-generated" label is on, its text/position, and the C2PA/Content-Credentials provenance state (enabled,
// signed vs unsigned, generator). Includes a sample manifest so counsel can see exactly what is embedded.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    return Response.json({
      ok: true,
      ...aiDisclosureConfig(),
      sample_manifest: buildContentCredentials({ kind: "video", tool: "AI Video Engine", model: "example" }),
      note: "Applied to every AI-generated creative (AI Creative Suite) and video (AI Video Engine). The visible label is stamped by the renderer; the manifest is stored with the asset. Not legal advice.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
