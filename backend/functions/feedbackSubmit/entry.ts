import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { feedbackEnabled, recordFeedback } from "../../sdk/feedback.ts";

// feedbackSubmit — the ONE endpoint every customer-interaction surface calls to record feedback (a thumbs, a
// rating, "was this helpful?", a report, or an implicit conversion/completion/dwell signal). It persists the
// event AND emits a learning signal, so every surface both invites feedback and improves the AI that runs it.
// Any signed-in user.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!feedbackEnabled()) return Response.json({ ok: true, skipped: "feedback disabled" });

    const body = await req.json().catch(() => ({}));
    if (!body.surface || !body.kind) return Response.json({ error: "surface and kind are required." }, { status: 400 });

    const weight = await recordFeedback(db, {
      surface: String(body.surface).slice(0, 80),
      domain: body.domain ? String(body.domain).slice(0, 40) : undefined,
      kind: body.kind,
      value: Number(body.value),
      subject_id: body.subject_id ? String(body.subject_id).slice(0, 80) : undefined,
      user_id: user.id,
      comment: body.comment ? String(body.comment) : undefined,
      meta: (body.meta && typeof body.meta === "object") ? body.meta : undefined,
    });

    return Response.json({ ok: true, recorded: true, weight, message: "Thanks — your feedback trains the AI that runs this." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
