import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { InvokeLLM } from "../../sdk/integrations.ts";
import { searchProductFeeds, feedsConfigured } from "../../sdk/product-feeds.ts";
import { chooseChannel, channelExplainer, type SourcedItem } from "../../sdk/sourcing.ts";

// aiOrderAssistant (authenticated) — the shopping copilot. The user says what they want; the AI searches
// authorized product feeds + the platform catalog, autofills real order options, and drafts a SourcedOrder
// the user reviews and approves. The AI does 100% of the discovery/autofill; the human only approves and
// completes their own purchase (assistedCheckout). No scraping, no bot.
//   Body: { request }  → { sourced_order_id, items[], recommendation, note }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { request } = await req.json().catch(() => ({}));
    if (!request || String(request).trim().length < 2) return Response.json({ error: "Tell me what you're looking for." }, { status: 400 });
    const q = String(request).slice(0, 300);

    // 1) DISCOVERY — authorized feeds first, then the platform's own catalog as a fallback.
    let items: SourcedItem[] = await searchProductFeeds(q, { limit: 12 }).catch(() => []);
    if (items.length < 6) {
      const listings = await base44.asServiceRole.entities.MarketplaceListing.filter({ status: "active" }, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
      const ql = q.toLowerCase();
      for (const l of (listings || [])) {
        if (items.length >= 12) break;
        const title = String(l.title || "");
        if (!title.toLowerCase().includes(ql.split(" ")[0])) continue;
        items.push({ title, retailer: (l.source_label as string) || "GamerGain", supplier_id: null, buy_url: (l.affiliate_url as string) || null, price_usd: Number(l.price_usd) || 0, image_url: (l.image_url as string) || null, sku: String(l.id) });
      }
    }
    items = items.filter((x) => x.title && x.price_usd > 0).slice(0, 12);

    // 2) AUTOFILL / RECOMMEND — cheap AI ranks + explains; graceful if no LLM key (falls back to cheapest).
    let recommendationIdx = 0, note = "";
    if (items.length) {
      recommendationIdx = items.reduce((best, it, i, arr) => (it.price_usd < arr[best].price_usd ? i : best), 0);
      try {
        const r = await InvokeLLM({
          model: "gpt_5_mini",
          response_json_schema: { type: "object", properties: { pick_index: { type: "number" }, note: { type: "string" } } },
          prompt: `A user wants: "${q}". Pick the best of these options (return its index) and give a one-sentence reason. Options:\n` +
            items.map((it, i) => `${i}: ${it.title} — $${it.price_usd} (${it.retailer || "store"})`).join("\n"),
        });
        const gen = (r as Record<string, unknown>) || {};
        if (Number.isFinite(Number((gen as any).pick_index))) recommendationIdx = Math.max(0, Math.min(items.length - 1, Math.round(Number((gen as any).pick_index))));
        note = String((gen as any).note || "").slice(0, 300);
      } catch { /* fall back to cheapest */ }
    }

    // Attach the sanctioned channel each item will use, so the UI can show how checkout will work.
    const withChannels = items.map((it) => { const c = chooseChannel(it); return { ...it, channel: c.channel, fully_automated: c.fully_automated, merchant_of_record: c.merchant_of_record, checkout_note: channelExplainer(c.channel) }; });

    // 3) DRAFT — save the SourcedOrder for approval.
    const draft = await base44.asServiceRole.entities.SourcedOrder.create({
      user_id: user.id, request: q, items: withChannels, recommendation_index: recommendationIdx, note,
      status: "drafted", feeds_connected: feedsConfigured(), created_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({
      sourced_order_id: (draft as any)?.id || null,
      items: withChannels,
      recommendation: withChannels[recommendationIdx] || null,
      recommendation_index: recommendationIdx,
      note: note || (withChannels.length ? "Here are the closest matches I found." : "I couldn't find a match — try more detail, or connect a product feed."),
      feeds_connected: feedsConfigured(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
