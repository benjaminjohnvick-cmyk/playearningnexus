import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { InvokeLLM } from "../../sdk/integrations.ts";
import { adgridQuestionsPerThumbnail } from "../../sdk/adgrid.ts";
import { recordContentLicense, contentLicenseVersion } from "../../sdk/content-license.ts";

// createAdGridAd (authenticated advertiser) — create a PPC AdGrid ad: a product thumbnail + 2 survey
// questions (A-D options) + a product page (name, image, Buy Now). The advertiser writes it by hand, or sets
// ai_generate:true and we draft the questions + product-page copy from a prompt.
//   Body: { product_name, image_url?, product_url?, questions?: [{q, options:[..]}], product_page?: {description},
//           ai_generate?: boolean, prompt?: string }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    if (!b.product_name) return Response.json({ error: "product_name required" }, { status: 400 });

    // DMCA: capture the uploader's rights attestation + license grant before we host their content.
    if (b.rights_attestation !== true) {
      return Response.json({ error: "rights_attestation required: certify you own or are licensed to use this content.", needs_attestation: true }, { status: 400 });
    }

    const needQ = adgridQuestionsPerThumbnail();
    let questions = Array.isArray(b.questions) ? b.questions.slice(0, needQ) : [];
    let productPage = b.product_page && typeof b.product_page === "object" ? b.product_page : null;

    if (b.ai_generate) {
      try {
        const r = await InvokeLLM({
          model: "gpt_5_mini",
          response_json_schema: {
            type: "object",
            properties: {
              questions: { type: "array", items: { type: "object", properties: { q: { type: "string" }, options: { type: "array", items: { type: "string" } } } } },
              product_page: { type: "object", properties: { description: { type: "string" } } },
            },
          },
          prompt: `Write ${needQ} short multiple-choice consumer-sentiment questions (each with 4 options A-D) and a 2-3 sentence product-page description for this product. Product: "${b.product_name}". ${b.prompt || ""} Return JSON.`,
        });
        const gen = (r as Record<string, unknown>) || {};
        if (!questions.length && Array.isArray((gen as any).questions)) questions = (gen as any).questions.slice(0, needQ);
        if (!productPage && (gen as any).product_page) productPage = (gen as any).product_page;
      } catch { /* fall back to whatever the advertiser supplied */ }
    }

    // Normalize questions: ensure options A-D.
    questions = (questions || []).slice(0, needQ).map((q: any) => ({
      q: String(q?.q || "").slice(0, 300),
      options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map((o: any) => String(o).slice(0, 120)),
    })).filter((q: any) => q.q);

    if (questions.length < needQ) {
      return Response.json({ error: `Provide ${needQ} questions (or set ai_generate:true).`, got: questions.length }, { status: 400 });
    }

    const ad = await base44.asServiceRole.entities.AdGridAd.create({
      advertiser_user_id: user.id,
      product_name: String(b.product_name).slice(0, 200),
      image_url: b.image_url || null,
      product_url: b.product_url || null,
      product_page: { description: String(productPage?.description || "").slice(0, 2000) },
      questions,
      status: "active",
      rights_attested: true,
      rights_attested_at: new Date().toISOString(),
      content_license_version: contentLicenseVersion(),
      created_at: new Date().toISOString(),
    });

    await recordContentLicense({ userId: String(user.id), contentType: "ad_creative", contentRef: String((ad as any).id) });

    return Response.json({ success: true, ad_id: (ad as any).id, questions, product_page: (ad as any).product_page });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
