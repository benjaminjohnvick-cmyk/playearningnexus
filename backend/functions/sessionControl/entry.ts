import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { canGrantControl } from "../../sdk/session-capabilities.ts";

// sessionControl — the server-authoritative record of WHO currently holds scoped control in a session (the
// "borrow functionality / co-op" capability). The host grants control to another player for in-game input ONLY;
// the scope guard (canGrantControl) refuses anything touching the OS, navigation, account, or money. Control is
// revocable at any time and is only ever a hint the clients honor for GAME input — it can never reach a sensitive
// action, because those don't run in the session path at all. Gated behind HOSTING_REMOTE_CONTROL_ENABLED.
//
//   action: "grant"   body: { session_id, grantee_player_id, scope:"game_input" }
//   action: "revoke"  body: { session_id }
//   action: "status"  body: { session_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const sessionId = String(body?.session_id || "");
    if (!sessionId) return Response.json({ error: "session_id required" }, { status: 400 });

    const sess = (await db.filter("GameSession", { session_id: sessionId }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });

    if (action === "status") {
      return Response.json({ ok: true, control_holder: sess.control_holder ?? null, control_scope: sess.control_scope ?? null });
    }

    if (!snapBool("HOSTING_REMOTE_CONTROL_ENABLED", false)) {
      return Response.json({ error: "Remote control / co-op is disabled (HOSTING_REMOTE_CONTROL_ENABLED off)." }, { status: 409 });
    }
    // Only the host may grant or revoke control in their session.
    const isHost = String(sess.host_player_id || "") === String(user.id) || String(sess.started_by || "") === (user.email ?? String(user.id));
    if (!isHost) return Response.json({ error: "only the session host can grant or revoke control" }, { status: 403 });

    if (action === "revoke") {
      await db.update("GameSession", String(sess.id), { control_holder: null, control_scope: null, control_updated_at: new Date().toISOString() }).catch(() => null);
      return Response.json({ ok: true, control_holder: null, note: "Control returned to the host." });
    }

    if (action === "grant") {
      const grantee = String(body?.grantee_player_id || "");
      const scope = String(body?.scope || "game_input");
      if (!grantee) return Response.json({ error: "grantee_player_id required" }, { status: 400 });
      if (!Array.isArray(sess.player_ids) || !sess.player_ids.map(String).includes(grantee)) {
        return Response.json({ error: "grantee is not a participant of this session" }, { status: 403 });
      }
      const scopeCheck = canGrantControl(scope);
      if (!scopeCheck.ok) return Response.json({ error: scopeCheck.reason }, { status: 403 });

      await db.update("GameSession", String(sess.id), {
        control_holder: grantee, control_scope: scope, control_granted_by: user.id, control_updated_at: new Date().toISOString(),
      }).catch(() => null);
      return Response.json({ ok: true, control_holder: grantee, control_scope: scope, note: `In-game control granted to ${grantee}. Revocable anytime; never reaches OS/account/money.` });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
