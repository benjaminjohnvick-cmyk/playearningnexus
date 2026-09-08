import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { buildLlmsTxt, seoSiteName, aiSearchEnabled } from "../../sdk/seo.ts";

// seoLlmsTxt (admin) — generate the llms.txt manifest, the emerging standard that tells AI answer engines what
// the site is and where its key content lives (so they can find, quote, and cite it correctly). Returns the text
// to publish at /llms.txt. Pass { summary, sections } to customize; otherwise sensible defaults for this site.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const body = await req.json().catch(() => ({}));
    const sections = Array.isArray(body?.sections) && body.sections.length ? body.sections : DEFAULT_SECTIONS;
    const summary = body?.summary ? String(body.summary) : undefined;
    const text = buildLlmsTxt({ summary, sections });
    return Response.json({
      ok: true, ai_search_enabled: aiSearchEnabled(), site: seoSiteName(),
      filename: "llms.txt", content: text,
      note: "Publish this at https://<yoursite>/llms.txt so AI answer engines can index the site's key content.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

const DEFAULT_SECTIONS = [
  { title: "Shop", links: [{ label: "Store", path: "/InAppGameStore" }, { label: "Wishlist", path: "/Wishlist" }, { label: "Pricing", path: "/Pricing" }] },
  { title: "Earn", links: [{ label: "Surveys", path: "/Surveys" }, { label: "Referrals", path: "/ReferralContest" }, { label: "Dashboard", path: "/UserDashboard" }] },
  { title: "Advertisers", links: [{ label: "Advertise", path: "/Advertise" }, { label: "Business dashboard", path: "/BusinessDashboard" }] },
  { title: "Trust & policy", links: [{ label: "Privacy policy", path: "/PrivacyPolicy" }, { label: "Terms of service", path: "/TermsOfService" }, { label: "Refund policy", path: "/RefundPolicy" }] },
];
