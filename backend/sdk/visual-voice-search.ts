// visual-voice-search.ts — the shared logic behind two new product-discovery modes:
//   • IMAGE search — a shopper uploads a photo; a vision model identifies the product (name + brand + key
//     attributes), and that identity drives a normal product-feed search.
//   • VOICE search — a shopper speaks; the client transcribes on-device (Web Speech API) where available, and
//     falls back to server transcription (transcription.ts / Whisper) for browsers without it (notably the
//     iOS WebView). Either way the transcript drives a normal product-feed search.
//
// The vision call itself lives in the imageProductSearch function (it needs the request-scoped client); this
// module holds the enable flags, the identify prompt + JSON schema, and the shared feed-search wrapper so both
// modes return results in the SAME shape the text productSearch returns.
import { snapBool } from "./settings.ts";
import { searchProductFeeds, feedsConfigured } from "./product-feeds.ts";
import { chooseChannel } from "./sourcing.ts";

/** Master switches — everything-on-by-default, per platform convention. The capture itself always requires the
 *  user's own mic/camera permission (the browser/OS prompts); these only gate whether the UI offers the mode. */
export const voiceSearchEnabled = () => snapBool("VOICE_SEARCH_ENABLED", true);
export const imageSearchEnabled = () => snapBool("IMAGE_SEARCH_ENABLED", true);

/** The structured product identity a vision model returns for an uploaded image. */
export interface ImageProductIdentity {
  query: string;        // the best short search phrase, e.g. "Sony WH-1000XM5 headphones"
  brand?: string;
  category?: string;
  attributes?: string[]; // color, size, model, distinguishing features
  confidence?: number;   // 0..1 self-reported
}

/** Prompt for the vision model: identify the product in the image as a searchable query. */
export const IMAGE_IDENTIFY_PROMPT =
  "You are a visual product-search engine. Look at the uploaded image and identify the single main product a " +
  "shopper is trying to find. Return the most specific product you can (brand + model + variant where visible). " +
  "Give a concise search phrase a retailer search box would understand, plus brand, category, and key visible " +
  "attributes (color, size, model). If you cannot tell, return your best guess with a low confidence.";

export const IMAGE_IDENTIFY_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string" },
    brand: { type: "string" },
    category: { type: "string" },
    attributes: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["query"],
} as const;

/** Normalize whatever the vision model returned into an ImageProductIdentity (defensive). */
export function toIdentity(raw: unknown): ImageProductIdentity {
  const o = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
  const query = String(o.query ?? o.product ?? o.name ?? "").trim();
  const attributes = Array.isArray(o.attributes) ? o.attributes.map((a) => String(a)).filter(Boolean).slice(0, 12) : undefined;
  const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : undefined;
  return { query, brand: o.brand ? String(o.brand) : undefined, category: o.category ? String(o.category) : undefined, attributes, confidence };
}

export interface TaggedProduct {
  title: string;
  price_usd: number;
  channel: string;
  fully_automated: boolean;
  [k: string]: unknown;
}

/** Search the connected product feeds for a query and tag each result with its sanctioned checkout channel —
 *  the SAME normalization + shape the text productSearch uses, so image/voice results are drop-in compatible. */
export async function searchProductsForQuery(query: string, limit = 20): Promise<TaggedProduct[]> {
  const q = String(query || "").trim();
  if (!q) return [];
  const items = await searchProductFeeds(q, { limit: Math.max(1, Math.min(Number(limit) || 20, 50)) }).catch(() => []);
  return items.map((it) => {
    const c = chooseChannel(it);
    return { ...it, channel: c.channel, fully_automated: c.fully_automated } as TaggedProduct;
  });
}

export { feedsConfigured };
