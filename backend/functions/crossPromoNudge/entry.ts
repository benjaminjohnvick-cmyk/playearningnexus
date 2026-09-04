import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { pickNudge, crossPromoEnabled, type NudgeContext } from "../../sdk/cross-promo.ts";

// crossPromoNudge (authenticated) — the flywheel's cross-promotion brain (PROFIT-FLYWHEEL blueprint §3). Given
// the transition the user just reached ("context"), returns the ONE best OTHER avenue to point them at (refer /
// spend / Premium / shopping / social / survey), server-authoritatively — eligibility (e.g. don't sell Premium
// to a premium member, don't sell "spend" to a $0 balance) is decided here, never on the client.
//
//   { context }  →  { nudge: {key,title,body,cta,url,icon,context} | null, enabled }
//
// Pure marketing: it charges nothing, posts nothing, moves nothing. The client renders the returned copy as a
// small dismissible card and links to `url`. Returns nudge:null when the system is off for that context or the
// user is eligible for nothing — the client then shows no card.
const VALID: NudgeContext[] = ["post_survey", "post_earn", "checkout", "milestone", "leaderboard", "dashboard", "app"];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ctx = String(body?.context ?? "dashboard") as NudgeContext;
    if (!VALID.includes(ctx)) {
      return Response.json({ error: `unknown context '${ctx}'`, valid: VALID }, { status: 400 });
    }

    if (!crossPromoEnabled(ctx)) return Response.json({ enabled: false, nudge: null });

    const nudge = pickNudge(ctx, user as Record<string, unknown>);
    return Response.json({ enabled: true, nudge });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
