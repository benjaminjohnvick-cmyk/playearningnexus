import { __handler } from "../../sdk/runtime.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { officialRules, contestDisclosure } from "../../sdk/contest-rules.ts";

// contestOfficialRules (public read) — the canonical Official Rules + short disclosure for the weekly
// prize competition, assembled live from settings + the jurisdiction engine. Link this from every
// contest/jackpot page and next to every entry control. No auth required; jurisdiction-aware if signed in.
export default __handler(async (req) => {
  try {
    let jur: string | null = null;
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      jur = user?.jurisdiction ?? user?.state ?? null;
    } catch { /* public/anonymous — fall back to default rules */ }

    const url = new URL(req.url);
    const jurParam = url.searchParams.get("jurisdiction");
    const jurisdiction = jurParam || jur;

    return Response.json({
      disclosure: contestDisclosure(jurisdiction),
      official_rules: officialRules(jurisdiction),
      not_legal_advice: true,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
