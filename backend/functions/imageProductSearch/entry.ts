import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  imageSearchEnabled, searchProductsForQuery, feedsConfigured,
  IMAGE_IDENTIFY_PROMPT, IMAGE_IDENTIFY_SCHEMA, toIdentity, type ImageProductIdentity,
} from "../../sdk/visual-voice-search.ts";

// imageProductSearch (authenticated) — search for products by uploading an IMAGE. A vision model identifies the
// product in the photo (brand + model + attributes), and that identity drives a product-feed search. Results
// come back in the SAME shape as the text productSearch, each tagged with its sanctioned checkout channel.
//   Body: { image_url, query?, limit? }
//     - image_url: an uploaded image URL (from Core.UploadFile).
//     - query:     optional pre-identified text (e.g. the client already ran vision) — skips the server call.
// Returns { results, count, query, identity, feeds_connected, identified_by }.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!imageSearchEnabled()) return Response.json({ success: true, enabled: false, note: "Image search is disabled (IMAGE_SEARCH_ENABLED)." });

    const { image_url, query, limit } = await req.json().catch(() => ({}));
    if (!image_url && !query) return Response.json({ error: "image_url or query required" }, { status: 400 });

    let identity: ImageProductIdentity = { query: String(query || "").trim() };
    let identifiedBy = query ? "client" : "none";

    // Server-side vision identification when the client hasn't already done it.
    if (!identity.query && image_url) {
      try {
        const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: IMAGE_IDENTIFY_PROMPT,
          file_urls: [String(image_url)],
          add_context_from_internet: true,
          response_json_schema: IMAGE_IDENTIFY_SCHEMA,
        });
        identity = toIdentity(raw);
        identifiedBy = identity.query ? "vision" : "none";
      } catch {
        identifiedBy = "vision_unavailable";
      }
    }

    if (!identity.query) {
      return Response.json({
        success: true, results: [], count: 0, query: "", identity,
        feeds_connected: feedsConfigured(), identified_by: identifiedBy,
        note: "Could not identify a product from the image. Try a clearer photo or type the product name.",
      });
    }

    const results = await searchProductsForQuery(identity.query, Number(limit) || 20);
    return Response.json({
      success: true, results, count: results.length,
      query: identity.query, identity,
      feeds_connected: feedsConfigured(), identified_by: identifiedBy,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
