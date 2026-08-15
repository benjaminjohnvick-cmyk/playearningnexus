import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// submitAdvertiserApplication (public write) — captures an advertiser application / interest lead from the
// /Apply page. Marketing/CRM only: it records interest so you can follow up. It NEVER originates credit or
// charges anything. Works logged-in or not (captures the user id if present).
//   Body: { name, company?, email, website?, monthly_budget_usd?, interest?, notes? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let userId: string | null = null;
    let userEmail: string | null = null;
    try { const u = await base44.auth.me(); userId = (u?.id as string) ?? null; userEmail = (u?.email as string) ?? null; } catch { /* anonymous is fine */ }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? userEmail ?? "").trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "A valid email is required so we can follow up." }, { status: 400 });
    }
    const name = String(body.name ?? "").trim().slice(0, 200);
    const interest = String(body.interest ?? "founding_tier1").trim().slice(0, 80);

    const row = await db.create("AdvertiserApplication", {
      user_id: userId,
      name,
      company: String(body.company ?? "").trim().slice(0, 200),
      email,
      website: String(body.website ?? "").trim().slice(0, 300),
      monthly_budget_usd: Math.max(0, Number(body.monthly_budget_usd) || 0),
      interest,                         // founding_tier1 | tier2 | flexpay | tier1_financed | goods_advance
      notes: String(body.notes ?? "").trim().slice(0, 2000),
      source: "apply_page",
      status: "new",
      consent_to_contact: true,         // they submitted the form to be contacted
      submitted_at: new Date().toISOString(),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    }, userId ?? undefined);

    return Response.json({
      success: true, application_id: (row as Record<string, unknown>)?.id ?? null,
      note: "Thanks — your application is in. We'll be in touch. (No payment or credit is set up by applying.)",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
