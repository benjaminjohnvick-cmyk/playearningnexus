// device-compute.js — runs NON-AUTHORITATIVE per-user work on the user's OWN device instead of on the server,
// over the local catalog copy (local-db.js). This is the "use people's devices to run our server's work" idea,
// done safely: catalog search, filtering, and personalization ranking are computed on the phone, so each user's
// device does its own share and the work scales for free as users join. The SERVER stays the source of truth and
// re-validates anything that matters — real price and availability are confirmed server-side at add-to-cart, and
// rewards/balances are always server-authoritative. On-device ranking is presentation only; it can never move
// value or be trusted for a transaction.
//
// Pure functions (search/filter/rank/buildProfile) are deterministic and unit-tested. The orchestrator reads the
// prefetched catalog from the device and, if there's no local copy yet, tells the caller to fall back to the
// server path.

import * as localDb from "./local-db.js";

const norm = (s) => String(s ?? "").toLowerCase();
const tokenize = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Tolerant normalizer — catalog items vary in shape, so read common field names with safe fallbacks. Keeps a
 *  reference to the original item so callers get their own objects back. */
export function normalizeItem(raw) {
  const r = raw || {};
  const price = Number(r.price ?? (r.price_cents != null ? r.price_cents / 100 : 0)) || 0;
  return {
    id: r.id ?? r._id ?? "",
    title: r.title ?? r.name ?? "",
    category: r.category ?? r.department ?? "",
    subcategory: r.subcategory ?? r.sub ?? "",
    tags: Array.isArray(r.tags) ? r.tags : (Array.isArray(r.keywords) ? r.keywords : []),
    price,
    popularity: Number(r.popularity ?? r.sales ?? r.views ?? 0) || 0,
    _raw: raw,
  };
}

/** On-device search over the local catalog. Weighted token match: title > tags > category, with a light
 *  popularity tiebreaker. Returns the ORIGINAL items, most-relevant first. Pure. */
export function searchCatalog(items, query, { limit = 50 } = {}) {
  const q = tokenize(query);
  if (!q.length) return items.slice(0, limit);
  const scored = [];
  for (const raw of items) {
    const it = normalizeItem(raw);
    const title = tokenize(it.title);
    const cat = tokenize(`${it.category} ${it.subcategory}`);
    const tags = tokenize((it.tags || []).join(" "));
    let score = 0;
    for (const term of q) {
      if (title.includes(term)) score += 5;
      else if (title.some((t) => t.startsWith(term))) score += 3;
      if (tags.includes(term)) score += 2;
      if (cat.includes(term)) score += 1;
    }
    if (score > 0) scored.push({ raw, score: score + Math.min(1, it.popularity / 10000) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.raw);
}

/** On-device filtering (category / price band / tags). Returns the ORIGINAL items. Pure. */
export function filterCatalog(items, { category, subcategory, minPrice, maxPrice, tags } = {}) {
  const tagSet = Array.isArray(tags) && tags.length ? new Set(tags.map(norm)) : null;
  return items.filter((raw) => {
    const it = normalizeItem(raw);
    if (category && norm(it.category) !== norm(category) && norm(it.subcategory) !== norm(category)) return false;
    if (subcategory && norm(it.subcategory) !== norm(subcategory)) return false;
    if (minPrice != null && it.price < minPrice) return false;
    if (maxPrice != null && it.price > maxPrice) return false;
    if (tagSet) { const its = new Set((it.tags || []).map(norm)); if (![...tagSet].some((t) => its.has(t))) return false; }
    return true;
  });
}

/** Build a lightweight affinity profile from the user's OWN local interaction history (their data, on their
 *  device). No server round-trip, nothing personal leaves the phone. Pure. */
export function buildProfile(history = []) {
  const categoryAffinity = {}; const tagAffinity = {};
  let pSum = 0, pN = 0;
  for (const h of history) {
    const c = norm(h.category); if (c) categoryAffinity[c] = (categoryAffinity[c] || 0) + 1;
    for (const t of (h.tags || [])) { const k = norm(t); if (k) tagAffinity[k] = (tagAffinity[k] || 0) + 1; }
    const p = Number(h.price) || 0; if (p > 0) { pSum += p; pN++; }
  }
  return { categoryAffinity, tagAffinity, priceAvg: pN ? pSum / pN : 0 };
}

/** Rank items for THIS user on-device using their affinity profile. Presentation only — the server still decides
 *  real price/availability and anything that moves value. Returns ORIGINAL items, best-first. Pure. */
export function personalizeRanking(items, profile = {}, { limit = 50 } = {}) {
  const cat = profile.categoryAffinity || {};
  const tags = profile.tagAffinity || {};
  const pAvg = Number(profile.priceAvg) || 0;
  const scored = items.map((raw) => {
    const it = normalizeItem(raw);
    let score = Math.min(2, it.popularity / 10000);            // base popularity (bounded)
    score += (cat[norm(it.category)] || 0) * 1.5;              // category affinity
    for (const t of (it.tags || [])) score += (tags[norm(t)] || 0) * 0.5; // tag affinity
    if (pAvg > 0 && it.price > 0) score += Math.max(0, 1 - Math.abs(it.price - pAvg) / (pAvg + 1)); // price fit
    return { raw, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.raw);
}

/** Orchestrator: run a full catalog query ON THE DEVICE against the prefetched local catalog. Returns
 *  { fromDevice, items }. If there is no local catalog yet, fromDevice=false and items=[] so the caller falls
 *  back to the server. `prefetchKey` is the key used by resilient-mode's prefetch() (fnName:JSON(payload)). */
export async function deviceCatalogQuery({ prefetchKey, query, filters, profile, limit = 50 } = {}) {
  let slice = null;
  try { slice = await localDb.get("catalog", prefetchKey); } catch { slice = null; }
  const items = Array.isArray(slice) ? slice : (slice && (slice.items || slice.data)) || [];
  if (!Array.isArray(items) || items.length === 0) return { fromDevice: false, items: [] };

  let out = items;
  if (filters) out = filterCatalog(out, filters);
  if (query) out = searchCatalog(out, query, { limit: limit * 4 });
  if (profile) out = personalizeRanking(out, profile, { limit });
  return { fromDevice: true, items: out.slice(0, limit), computed: { query: !!query, filtered: !!filters, personalized: !!profile } };
}
