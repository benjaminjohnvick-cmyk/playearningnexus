import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { earnHookEnabled } from "../../sdk/earn-hook.ts";

// earnHookOfferSeen (authenticated) — the app calls this when it SHOWS the end-of-session "earn extra today?"
// offer, so the server can enforce the frequency cap (EARN_HOOK_OFFER_MIN_GAP_HOURS) and not over-show it.
// Optionally records the user's response (dismissed) so a repeatedly-dismissed offer can back off. Stores a
// timestamp only — no ads, no PII.  { dismissed? } → { ok } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnHookEnabled()) return Response.json({ ok: true, skipped: true });

    const body = await req.json().catch(() => ({}));
    const uid = String(user.id);
    const prev = Number((user as Record<string, unknown>).earn_hook_offer_dismiss_count) || 0;
    await db.update("User", uid, {
      earn_hook_offer_last_shown: new Date().toISOString(),
      earn_hook_offer_dismiss_count: body.dismissed === true ? prev + 1 : 0,
    }).catch(() => null);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
