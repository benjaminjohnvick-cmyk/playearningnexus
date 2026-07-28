import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { shouldCapture, storeShot, storeSnapshot } from "../../sdk/session-capture.ts";

// sessionCaptureIngest (authenticated) — the client asks (action:"check") whether the current session is
// in the rotating sample; if so it periodically POSTs a tiny STRUCTURAL snapshot (action:"snapshot":
// viewport, scroll depth, click coords, element boxes — no pixels, ~1 KB, near-zero cost). A legacy
// image path (action:"frame") is still accepted for compatibility. Off by default (session_screenshots
// flag) and only a small fraction of sessions qualify, so most calls are a cheap "capture:false".
// Body: { action:"check"|"snapshot"|"frame", session_id, snapshot?, image?: dataURL, path? }
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

    if (body?.action === "snapshot") {
      if (!capture) return Response.json({ ok: true, stored: false, capture: false });
      if (!body?.snapshot) return Response.json({ error: "snapshot required" }, { status: 400 });
      const ok = await storeSnapshot(user.id, sessionId, body.snapshot);
      return Response.json({ ok: true, stored: ok, capture: true });
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
