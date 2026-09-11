import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { runProvisioningSelfTest } from "../../sdk/provisioning-selftest.ts";

// provisioningSelfTest (ADMIN) — actively verifies that each free-tier provider credential actually WORKS,
// rather than just checking the env var is present (that's setupStatus). Pings each provider's free verify
// endpoint — Groq models list, Cloudflare token verify, an idempotent tiny R2 probe object, Brevo account +
// whether EMAIL_FROM is a Verified sender. All free/non-billable; no AI generation, no image, no email send.
// Changes nothing. Returns green when every configured provider passes; a provider you haven't set up is
// "skipped", not a failure. Run it after wiring keys, or any time an AI/media/email feature misbehaves.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

    const result = await runProvisioningSelfTest();
    const failed = result.summary.failed.length;
    const note = result.summary.overall === "green"
      ? (result.summary.configured === 0
          ? "No providers configured yet — nothing to verify. Wire the free-tier keys (see OPEN-TASKS.md / SCALE-FLIPS.md)."
          : `All ${result.summary.ok} configured provider(s) verified working. Read-only — nothing was changed.`)
      : `${failed} configured provider(s) failed — see each check's detail for the exact fix. Read-only — nothing was changed.`;

    return Response.json({ ok: true, ...result, note });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
