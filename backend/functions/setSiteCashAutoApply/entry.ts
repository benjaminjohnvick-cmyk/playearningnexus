import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { SITE_CASH_AUTO_APPLY_FIELD, resolveSiteCashAutoApply, siteCashAutoApplyEnabled } from "../../sdk/site-cash-apply.ts";

// setSiteCashAutoApply (auth) — the buyer's OWN preference: automatically apply my Site Cash to purchases at
// checkout, or not. This overrides the site-wide default for this user. Send { auto_apply: true|false } to set,
// or { reset: true } to clear the preference and fall back to the site default. GET/empty body just reads it.
//   Body: { auto_apply?: boolean, reset?: boolean }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));

    // Read-only: no actionable field → report the current effective setting.
    if (body.auto_apply === undefined && body.reset !== true) {
      const cur = (user as Record<string, unknown>)[SITE_CASH_AUTO_APPLY_FIELD];
      return Response.json({
        auto_apply: resolveSiteCashAutoApply(user as Record<string, unknown>),
        is_user_set: cur === true || cur === false || cur === "on" || cur === "off",
        site_default: siteCashAutoApplyEnabled(),
      });
    }

    if (body.reset === true) {
      await db.update("User", uid, { [SITE_CASH_AUTO_APPLY_FIELD]: null }, uid);
      return Response.json({ ok: true, reset: true, auto_apply: siteCashAutoApplyEnabled(), is_user_set: false, note: "Cleared — using the site default." });
    }

    const val = !!body.auto_apply;
    await db.update("User", uid, { [SITE_CASH_AUTO_APPLY_FIELD]: val }, uid);
    return Response.json({
      ok: true, auto_apply: val, is_user_set: true,
      note: val
        ? "Your Site Cash will be applied automatically at checkout to lower what you pay."
        : "Auto-apply is off — you'll choose whether to use your Site Cash on each purchase.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
