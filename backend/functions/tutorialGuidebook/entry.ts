import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { renderGuidebookMarkdown } from "../../sdk/tutorial-content.ts";

// tutorialGuidebook — the downloadable guidebook, rendered from the SAME single source as the in-app tutorial
// (tutorial-content.ts) so the two never drift. Two actions:
//   • default / "get"  — return the guidebook Markdown so the client can show it or let the user DOWNLOAD it.
//   • "email"          — email the guidebook to the user's OWN email so they can read it later.
// Read-only for content; email goes only to the signed-in user's own address. Gated behind TUTORIAL_ENABLED.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("TUTORIAL_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Tutorial is off (TUTORIAL_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const markdown = renderGuidebookMarkdown();

    if (String(body?.action || "") === "email") {
      const to = String(user.email || "").trim();
      if (!to) return Response.json({ ok: false, error: "No email on file for your account." }, { status: 400 });
      const sent = await base44.asServiceRole.integrations.Core.SendEmail({
        to,                                   // the signed-in user's OWN address only
        from_name: "Get Goods Gratis",
        subject: "Your Get Goods Gratis guidebook",
        body: `Hi ${user.full_name || "there"},\n\nHere's your guidebook to keep and read whenever you like.\n\n${markdown}\n\n— Get Goods Gratis`,
      }).catch((e: unknown) => ({ error: String((e as Error)?.message || e) }));
      const ok = !(sent && (sent as Record<string, unknown>).error);
      return Response.json({ ok, emailed_to: ok ? to : null, note: ok ? "Guidebook emailed to you." : "Could not send the email right now." });
    }

    return Response.json({
      ok: true, format: "markdown", filename: "Get-Goods-Gratis-Guidebook.md", markdown,
      can_email: !!user.email,
      note: "Download the guidebook, or call with action:'email' to have it sent to your email to read later.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
