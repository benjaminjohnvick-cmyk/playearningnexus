import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getSurveyAdminView } from "../../sdk/kyc.ts";

// kycSurveyAdminGet (ADMIN) — everything the KYC-survey editor needs: the ACTIVE survey members see,
// the built-in DEFAULT (to reset to), and any pending AI PROPOSAL awaiting approval.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const view = await getSurveyAdminView();
    return Response.json(view);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
