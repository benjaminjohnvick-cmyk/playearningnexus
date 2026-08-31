import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { normalizeLocale, correctionKey, shouldGraduate } from "../../sdk/translation.ts";

// translationCorrection — the self-learning input. A user (or a native speaker) corrects a translated term for a
// specific dialect; we remember it. The same correction seen enough times GRADUATES from the user's personal
// glossary into the SHARED glossary for that dialect, so everyone's translations improve. Storage-light: we store
// the correction delta (source→preferred), not a language. Gated behind AUTO_TRANSLATE_ENABLED.
//
// Body: { locale, source, preferred }  — source = the term as translated, preferred = the correct dialect term.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("AUTO_TRANSLATE_ENABLED", false)) {
      return Response.json({ error: "Auto-translate is off (AUTO_TRANSLATE_ENABLED)." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const { language, dialect } = normalizeLocale(String(body?.locale || user.locale || ""));
    const source = String(body?.source || "").trim();
    const preferred = String(body?.preferred || "").trim();
    if (!language || !source || !preferred) return Response.json({ error: "locale, source, and preferred are required" }, { status: 400 });

    const key = correctionKey(language, dialect, source);
    const threshold = Math.max(1, await getNumber("TRANSLATION_GRADUATE_THRESHOLD", 3));

    // Upsert this user's correction (personal scope), bumping a confirmation count.
    const [mine] = await db.filter("DialectGlossary", { key, created_by_user: user.id }, undefined, 1).catch(() => []) as Record<string, unknown>[];
    if (mine?.id) {
      await db.update("DialectGlossary", String(mine.id), { preferred, count: (Number(mine.count) || 1) + 1, updated_at: new Date().toISOString() }).catch(() => null);
    } else {
      await db.create("DialectGlossary", { key, language, dialect, source, preferred, scope: "personal", count: 1, created_by_user: user.id, created_at: new Date().toISOString() }).catch(() => null);
    }

    // Graduation: count DISTINCT users who submitted this correction; once >= threshold, promote to shared.
    const all = await db.filter("DialectGlossary", { key }, undefined, 1000).catch(() => []) as Record<string, unknown>[];
    const distinctUsers = new Set(all.map((r) => String(r.created_by_user ?? ""))).size;
    let graduated = false;
    if (shouldGraduate(distinctUsers, threshold)) {
      const [sharedRow] = await db.filter("DialectGlossary", { key, scope: "shared" }, undefined, 1).catch(() => []) as Record<string, unknown>[];
      if (!sharedRow) {
        await db.create("DialectGlossary", { key, language, dialect, source, preferred, scope: "shared", confidence: distinctUsers, graduated_at: new Date().toISOString(), created_at: new Date().toISOString() }).catch(() => null);
      } else {
        await db.update("DialectGlossary", String(sharedRow.id), { preferred, confidence: distinctUsers, updated_at: new Date().toISOString() }).catch(() => null);
      }
      graduated = true;
    }

    return Response.json({
      ok: true, language, dialect, source, preferred,
      distinct_confirmations: distinctUsers, graduated,
      note: graduated
        ? `Learned for everyone in ${language}${dialect ? ` (${dialect})` : ""} — confirmed by ${distinctUsers} user(s).`
        : `Saved to your personal glossary. Shared once ${threshold} users confirm it.`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
