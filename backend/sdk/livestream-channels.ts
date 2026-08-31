// livestream-channels.ts — pure logic for the Omni-Channel Livestream shopping category. The category's
// SUBCATEGORIES mirror the existing shopping sections; each subcategory is a "channel" of related products, and
// the products being sold get an AI image + (optionally) a short AI commercial so catalog, livestream, and social
// stay one connected system. This file decides WHAT to feature and builds the render brief; the DB reads and the
// image/video generation live in the functions.

export interface FeaturedItem {
  item_name: string;
  subcategory: string;   // resolved by the caller; falls back to "Trending" if unknown
  seller_id?: string | null;
  units?: number;
  revenue_usd?: number;
}

export interface Channel {
  channel: string;              // subcategory name
  products: FeaturedItem[];
}

/** Group featured products (e.g. top sellers) into subcategory "channels", keeping the strongest `perChannel`
 *  per channel by units then revenue. Items with no subcategory bucket under "Trending". Pure + deterministic. */
export function buildChannelPlan(items: FeaturedItem[], perChannel = 3): Channel[] {
  const byChannel = new Map<string, FeaturedItem[]>();
  for (const it of (items || [])) {
    const name = String(it?.item_name ?? "").trim();
    if (!name) continue;
    const ch = String(it?.subcategory ?? "").trim() || "Trending";
    const arr = byChannel.get(ch) ?? [];
    arr.push({ ...it, item_name: name, subcategory: ch });
    byChannel.set(ch, arr);
  }
  const channels: Channel[] = [];
  for (const [channel, arr] of byChannel) {
    arr.sort((a, b) => (Number(b.units) || 0) - (Number(a.units) || 0) || (Number(b.revenue_usd) || 0) - (Number(a.revenue_usd) || 0) || (a.item_name < b.item_name ? -1 : 1));
    channels.push({ channel, products: arr.slice(0, Math.max(1, perChannel)) });
  }
  // Stable channel order: most total units first, then name.
  channels.sort((a, b) => totalUnits(b) - totalUnits(a) || (a.channel < b.channel ? -1 : 1));
  return channels;
}

function totalUnits(c: Channel): number { return c.products.reduce((s, p) => s + (Number(p.units) || 0), 0); }

/** The flat list of (channel, product) pairs to render this run, capped. Pure. */
export function renderWorklist(channels: Channel[], cap = 10): Array<{ channel: string; item_name: string }> {
  const out: Array<{ channel: string; item_name: string }> = [];
  for (const c of channels) {
    for (const p of c.products) {
      if (out.length >= Math.max(1, cap)) return out;
      out.push({ channel: c.channel, item_name: p.item_name });
    }
  }
  return out;
}

/** Render brief for a product commercial, with the ad-compliance lines baked in (disclosed AI + #ad, no real
 *  person, no guaranteed results). Pure. */
export function commercialBrief(itemName: string, channel: string, disclosureTag = "#ad"): { prompt: string; disclosure: Record<string, unknown> } {
  const prompt =
    `Create a short, upbeat product commercial for "${itemName}" (category: ${channel}) for a live-shopping ` +
    `channel. HARD REQUIREMENTS: the presenter/voice is AI-generated (make clear it is not a real person and does ` +
    `not depict a real individual); include the ad disclosure "${disclosureTag}"; describe the product's VALUE ` +
    `only — no guaranteed results, savings, or income claims; no fabricated testimonials; keep claims to what the ` +
    `listing actually states.`;
  return { prompt, disclosure: { ai_generated: true, not_a_real_person: true, ad_disclosure: disclosureTag, no_guaranteed_results: true } };
}
