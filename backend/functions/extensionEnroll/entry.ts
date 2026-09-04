import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { extensionEnabled } from "../../sdk/extension.ts";

// extensionEnroll (authenticated) — record the user's extension state + preferences. Install is the opt-in
// (marked here when the extension first calls in). Rewards are default-enrolled (opt-out); the browsing Layer B
// is a separate EXPLICIT opt-in. Tracking opt-in/out is logged in the consent ledger. This only stores the
// user's own choices — nothing auto-enables tracking.
//   { installed?, rewards_opt_out?, tracking_opt_in? } → { ok, prefs } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!extensionEnabled()) return Response.json({ error: "The extension isn't available right now." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const uid = String(user.id);
    const patch: Record<string, unknown> = {};

    if (body.installed !== undefined) patch.extension_installed = body.installed === true;
    if (body.rewards_opt_out !== undefined) patch.extension_rewards_opt_out = body.rewards_opt_out === true;

    let trackingChanged = false;
    let trackingOptIn: boolean | undefined;
    if (body.tracking_opt_in !== undefined) {
      trackingOptIn = body.tracking_opt_in === true;
      patch.extension_tracking_opt_in = trackingOptIn;
      trackingChanged = true;
    }

    if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });
    await db.update("User", uid, patch).catch(() => null);

    // Log the browsing-layer (profiling) opt-in/out — the consent that gates Layer B.
    if (trackingChanged) {
      await recordConsent({
        user_id: uid, kind: "extension_tracking_optin", version: "v1", accepted: trackingOptIn === true,
        meta: { source: "browser_extension" },
      }).catch(() => null);
    }

    return Response.json({
      ok: true,
      prefs: {
        installed: patch.extension_installed ?? (user as Record<string, unknown>).extension_installed === true,
        rewards_opt_out: patch.extension_rewards_opt_out ?? (user as Record<string, unknown>).extension_rewards_opt_out === true,
        tracking_opt_in: patch.extension_tracking_opt_in ?? (user as Record<string, unknown>).extension_tracking_opt_in === true,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
