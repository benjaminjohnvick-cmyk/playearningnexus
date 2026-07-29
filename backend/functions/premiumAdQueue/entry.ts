import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// premiumAdQueue (authenticated) — the member's queue of AI-generated ad posts awaiting their OK.
// Each is already #ad-disclosed and lightly tailored to the platform. The member either one-tap posts
// (where auto-post is available) or copies it and pastes it into their own app — both are compliant.
function tailorForPlatform(content: string, platform: string): string {
  const p = String(platform || "").toLowerCase();
  let c = String(content || "");
  if (p.includes("twitter") || p === "x") c = c.slice(0, 278);           // X length limit
  return c;
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("SocialMediaPost", { user_id: user.id, status: "pending_approval" }, "-created_date", 50).catch(() => []) as any[];
    const posts = rows.map((p) => ({
      id: p.id,
      platform: p.platform,
      content: tailorForPlatform(p.content, p.platform),
      post_type: p.post_type,               // "premium_ppc_ad" | "platform_own_ad"
      advertiser_id: p.ppc_advertiser_id ?? null,
      created_at: p.created_at ?? p.created_date,
    }));
    return Response.json({ posts, count: posts.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
