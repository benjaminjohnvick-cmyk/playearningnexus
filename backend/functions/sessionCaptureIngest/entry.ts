import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { shouldCapture, storeShot } from "../../sdk/session-capture.ts";

// sessionCaptureIngest (authenticated) — the client asks (action:"check") whether the current session
// is in the capture sample; if so it periodically POSTs a downscaled frame (action:"frame"). Off by
// default (session_screenshots flag) and only a small rotating fraction of sessions ever qualifies, so
// the vast majority of calls are a cheap "capture:false" and no image ever leaves the device.
// Body: { action:"check"|"frame", session_id, image?: dataURL, path? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const capture = await shouldCapture(user, sessionId, (user as any).country);

    if (body?.action === "check" || !body?.action) {
      return Response.json({ capture });
    }

    if (body?.action === "frame") {
      if (!capture) return Response.json({ ok: true, stored: false, capture: false });
      if (!body?.image) return Response.json({ error: "image required" }, { status: 400 });
      const url = await storeShot(user.id, sessionId, String(body.image), body?.path);
      return Response.json({ ok: true, stored: !!url, capture: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
