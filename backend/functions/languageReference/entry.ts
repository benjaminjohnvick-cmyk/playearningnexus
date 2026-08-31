import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { LANGUAGE_ESTIMATE, PANGRAMS, scriptNames } from "../../sdk/language-reference.ts";
import { generateProductImageUrl } from "../../sdk/image-gen.ts";

// languageReference — returns/refreshes the translation reference: the (estimated) count of languages & dialects
// and a PANGRAM per script (a font-coverage/display sample, NOT a translation mechanism). Optionally renders each
// pangram to an IMAGE for font preview (gated PANGRAM_IMAGES, bounded). Stored in LanguageReference so it can be
// refreshed. Gated behind LANGUAGE_REFERENCE_ENABLED.
//
//   action "get" (default) — return the current reference.
//   action "build"        — store/refresh it; with images:true, render pangram images (admin).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("LANGUAGE_REFERENCE_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Language reference is off (LANGUAGE_REFERENCE_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get");

    if (action === "get") {
      const [row] = await db.filter("LanguageReference", { kind: "reference" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      return Response.json({
        ok: true, enabled: true,
        estimate: row?.estimate ?? LANGUAGE_ESTIMATE,
        scripts: row?.pangrams ?? PANGRAMS,
        note: "Counts are estimates (no exact dialect count exists). Pangrams are a font/display coverage aid, not a translation mechanism.",
      });
    }

    if (action === "build") {
      if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
      const wantImages = body?.images === true && snapBool("PANGRAM_IMAGES", false);

      const pangrams = PANGRAMS.map((p) => ({ ...p })) as Array<Record<string, unknown>>;
      let images = 0;
      if (wantImages) {
        const cap = Math.max(1, Number(body?.per_run_cap) || 10);
        for (const p of pangrams) {
          if (images >= cap) break;
          const url = await generateProductImageUrl(`Font sample — ${p.script}`, `A clean image of the sentence: ${p.pangram}`, "font sample").catch(() => null);
          if (url) { p.image_url = url; images++; }
        }
      }

      const estimate = LANGUAGE_ESTIMATE;
      await db.create("LanguageReference", { kind: "reference", estimate, pangrams, scripts: scriptNames(), images_rendered: images, built_by: user.email ?? user.id, at: new Date().toISOString() }).catch(() => null);

      return Response.json({ ok: true, enabled: true, stored: true, scripts: scriptNames().length, images_rendered: images, estimate, note: wantImages ? `Reference stored; ${images} pangram image(s) rendered.` : "Reference stored (images off)." });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
