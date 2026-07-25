import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Stores a device's native push token (FCM/APNs) so the server can send push notifications.
// Called by the mobile app's native layer (src/lib/native.js) after it registers for push.
// Idempotent per (user, token): updates if the token already exists, else creates.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { token, platform } = await req.json();
    if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

    const existing = await base44.asServiceRole.entities.DeviceToken.filter({ token });
    if (existing?.length) {
      await base44.asServiceRole.entities.DeviceToken.update(existing[0].id, {
        user_id: user.id, platform: platform ?? "unknown", last_seen: new Date().toISOString(),
      });
      return Response.json({ ok: true, updated: true });
    }
    await base44.asServiceRole.entities.DeviceToken.create({
      user_id: user.id, token, platform: platform ?? "unknown", last_seen: new Date().toISOString(),
    });
    return Response.json({ ok: true, created: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
