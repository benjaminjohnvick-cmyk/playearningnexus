import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { searchProductFeeds, feedsConfigured } from "../../sdk/product-feeds.ts";
import { chooseChannel } from "../../sdk/sourcing.ts";

// productSearch (authenticated) — direct search of the connected product feeds (discovery), each result
// tagged with the sanctioned channel it will check out through. Returns [] (feeds_connected:false) when no
// feed is wired, so the UI can prompt to connect one.
//   Body: { query, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { query, limit } = await req.json().catch(() => ({}));
    if (!query) return Response.json({ error: "query required" }, { status: 400 });

    const items = await searchProductFeeds(String(query), { limit: Number(limit) || 20 }).catch(() => []);
    const tagged = items.map((it) => { const c = chooseChannel(it); return { ...it, channel: c.channel, fully_automated: c.fully_automated }; });
    return Response.json({ results: tagged, count: tagged.length, feeds_connected: feedsConfigured() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
