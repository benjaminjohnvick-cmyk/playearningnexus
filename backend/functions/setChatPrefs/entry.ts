import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { languageName } from "../../sdk/chat-i18n.ts";

// setChatPrefs (authenticated) — the user's chat language (what they READ messages in) and the countries
// they'd like to be matched with. Chat is auto-translated into their language on display.
//   Body: { lang, countries?: [ISO codes] }  → { success, lang, countries }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lang = String(body.lang || "en").toLowerCase().slice(0, 8);
    const countries = Array.isArray(body.countries) ? body.countries.map((c: unknown) => String(c).toUpperCase().slice(0, 3)).slice(0, 30) : [];

    await db.update("User", user.id, { chat_lang: lang, chat_countries: countries }).catch(() => null);
    return Response.json({ success: true, lang, language_name: languageName(lang), countries });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
