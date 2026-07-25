import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { signJwt } from "../../sdk/auth.ts";

// Reviewer / demo login. Returns a ready JWT for a seeded demo account so an App Store / Play
// reviewer (or a tester) can get into a populated app in one tap — no signup, no real data.
// GATED: only works when REVIEWER_DEMO=1 is set in the backend env. Off by default.
const DEMO_EMAIL = "reviewer@demo.gamergain.app";

export default __handler(async (req) => {
  if ((Deno.env.get("REVIEWER_DEMO") ?? "0") !== "1") {
    return Response.json({ error: "Demo login is disabled" }, { status: 403 });
  }
  try {
    const base44 = createClientFromRequest(req);
    let users = await base44.asServiceRole.entities.User.filter({ email: DEMO_EMAIL });
    let user = users?.[0];
    if (!user) {
      user = await base44.asServiceRole.entities.User.create({
        email: DEMO_EMAIL,
        full_name: "App Reviewer (Demo)",
        role: "user",
        current_balance: 25,
        is_demo: true,
      });
    }
    const token = await signJwt(user.id, { demo: true });
    return Response.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
