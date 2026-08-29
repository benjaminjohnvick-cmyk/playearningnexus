import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { recordFeedback } from "../../sdk/feedback.ts";

// trendChoiceVote — record which current-event topic the user picked from a fair set. The pick is logged (for
// exposure-normalized pick-rate) AND emitted as a learning signal on the "video" domain, so user interest in
// current events automatically steers which topics the content engine rides — no click-tracking guesswork.
// Any signed-in user.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("FAIR_CHOICE_ENABLED", true)) return Response.json({ ok: true, skipped: "fair choice disabled" });

    const body = await req.json().catch(() => ({}));
    const picked = String(body.picked ?? "").trim();
    const shown: string[] = Array.isArray(body.shown) ? body.shown.map(String) : [];
    if (!picked) return Response.json({ error: "picked is required." }, { status: 400 });
    if (shown.length && !shown.includes(picked)) return Response.json({ error: "picked must be one of the shown options." }, { status: 400 });

    const now = new Date().toISOString();
    await db.create("TrendChoiceEvent", { topic: picked, kind: "pick", user_id: user.id, shown, at: now, created_at: now }).catch(() => null);
    // Feed the shared learning substrate: the pick is a positive "choice" signal for the video/content domain.
    await recordFeedback(db, { surface: "TrendChoice", domain: "video", kind: "choice", value: 1, subject_id: picked, user_id: user.id, meta: { auto: true, shown_count: shown.length } }, now);

    return Response.json({ ok: true, picked, message: "Thanks — noted what's interesting to you." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
