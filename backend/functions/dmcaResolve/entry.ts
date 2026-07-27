import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// dmcaResolve (admin) — record the resolution of a DMCA request and apply the content state change.
//   body: { request_id, action: "removed" | "restored" | "rejected", notes? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { request_id, action, notes } = body;
    if (!request_id || !["removed", "restored", "rejected"].includes(action)) {
      return Response.json({ error: "request_id and action (removed|restored|rejected) required." }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.DMCARequest.filter({ id: request_id });
    const r = (rows || [])[0];
    if (!r) return Response.json({ error: "DMCA request not found." }, { status: 404 });

    await base44.asServiceRole.entities.DMCARequest.update(request_id, {
      status: action, resolved_by: user.id, resolution_notes: notes ?? null, resolved_at: new Date().toISOString(),
    });

    // Best-effort content state change on the identified item.
    if (r.infringing_content_id && r.content_type) {
      const patch = action === "removed"
        ? { status: "removed_dmca", dmca_flagged: true }
        : action === "restored"
          ? { status: "active", dmca_flagged: false }
          : { dmca_flagged: false };
      await base44.asServiceRole.entities[r.content_type].update(r.infringing_content_id, patch).catch(() => null);
    }

    return Response.json({ success: true, request_id, action });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
